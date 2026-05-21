import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

function normalizeSlugCandidate(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveDuplicateBaseSlug(original: { slug: string; canonicalUrl: string | null }): string {
  const canonical = String(original.canonicalUrl ?? "").trim();
  if (canonical) {
    try {
      const parsed =
        canonical.startsWith("http://") || canonical.startsWith("https://")
          ? new URL(canonical)
          : new URL(canonical, "https://placeholder.local");
      const pathname = (parsed.pathname || "").trim().replace(/^\/+|\/+$/g, "");
      const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
      const normalizedFromCanonical = normalizeSlugCandidate(lastSegment);
      if (normalizedFromCanonical) return normalizedFromCanonical;
    } catch {
      const path = canonical.split("?")[0]?.split("#")[0] ?? "";
      const lastSegment = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).pop() ?? "";
      const normalizedFromCanonical = normalizeSlugCandidate(lastSegment);
      if (normalizedFromCanonical) return normalizedFromCanonical;
    }
  }
  return normalizeSlugCandidate(original.slug) || original.slug.toLowerCase();
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let pageId: string | null = null;
  let targetDomainId: string | null = null;
  let targetSlug: string | null = null;
  let targetType: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (body) {
      pageId = body.pageId ? String(body.pageId) : null;
      if (body.domainId) {
        targetDomainId = String(body.domainId);
      }
      if (body.slug) {
        const trimmed = String(body.slug).trim();
        targetSlug = trimmed.length > 0 ? trimmed : null;
      }
      if (body.type) {
        const t = String(body.type).trim().toLowerCase();
        if (t === "buyer" || t === "seller") {
          targetType = t;
        }
      }
    }
  } else {
    const formData = await req.formData().catch(() => null);
    if (formData) {
      const rawId = formData.get("pageId");
      pageId = rawId != null ? String(rawId) : null;
      const rawDomain = formData.get("domainId");
      if (rawDomain != null) {
        targetDomainId = String(rawDomain);
      }
      const rawSlug = formData.get("slug");
      if (rawSlug != null) {
        const trimmed = String(rawSlug).trim();
        targetSlug = trimmed.length > 0 ? trimmed : null;
      }
      const rawType = formData.get("type");
      if (rawType != null) {
        const t = String(rawType).trim().toLowerCase();
        if (t === "buyer" || t === "seller") {
          targetType = t;
        }
      }
    }
  }

  if (!pageId) {
    return NextResponse.json(
      { error: "Missing pageId" },
      { status: 400 },
    );
  }

  const original = await prisma.landingPage.findUnique({
    where: { id: pageId },
  });
  if (original?.deletedAt) {
    return NextResponse.json(
      { error: "Archived pages cannot be duplicated. Restore first." },
      { status: 400 },
    );
  }

  if (!original) {
    return NextResponse.json(
      { error: "Page not found" },
      { status: 404 },
    );
  }

  const domainIdToUse = targetDomainId ?? original.domainId;
  const targetDomain = await prisma.domain.findUnique({
    where: { id: domainIdToUse },
    select: { hostname: true },
  });
  if (!targetDomain || !targetDomain.hostname) {
    return NextResponse.json(
      { error: "Domain not found for duplication target." },
      { status: 400 },
    );
  }

  const requestedSlugRaw =
    typeof targetSlug === "string" ? targetSlug.trim() : "";

  let slugToUse: string;

  if (requestedSlugRaw) {
    // Path 1: user explicitly provided a slug (e.g. via dialog). Enforce
    // global uniqueness for this exact slug.
    const normalizedSlug = requestedSlugRaw.toLowerCase();
    const conflict = await prisma.landingPage.findFirst({
      where: {
        slug: normalizedSlug,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        {
          error:
            "A page with this slug already exists. Please choose a different slug.",
        },
        { status: 400 },
      );
    }
    slugToUse = normalizedSlug;
  } else {
    // Path 2: quick duplicate from the 3-dot menu with no slug supplied.
    // Auto-generate a unique slug by appending -copy, -copy-2, etc.
    const duplicateBase = resolveDuplicateBaseSlug({
      slug: original.slug,
      canonicalUrl: original.canonicalUrl,
    });
    const baseSlug = `${duplicateBase}-copy`;
    let candidate = baseSlug.toLowerCase();

    for (let i = 1; i <= 50; i++) {
      const existing = await prisma.landingPage.findFirst({
        where: {
          slug: candidate,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!existing) {
        break;
      }
      candidate = `${baseSlug}-${i + 1}`.toLowerCase();
    }

    slugToUse = candidate;
  }

  const {
    id: _id,
    slug: _slug,
    domainId: _domainId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    sections,
    formSchema,
    multistepStepSlugs,
    seoKeywords,
    schemaMarkup,
    customHeadTags,
    ...rest
  } = original as any;

  const copy = await prisma.landingPage.create({
    data: {
      ...rest,
      type: (targetType as any) ?? rest.type,
      sections: sections as any,
      formSchema: formSchema as any,
      multistepStepSlugs: multistepStepSlugs as any,
      seoKeywords: seoKeywords as any,
      schemaMarkup: schemaMarkup as any,
      customHeadTags: customHeadTags as any,
      slug: slugToUse,
      canonicalUrl: `https://${targetDomain.hostname}/${slugToUse}`,
      status: "draft",
      domainId: domainIdToUse,
    },
  });

  // Duplicate layout configuration if it exists
  try {
    const originalLayout = await prisma.pageLayout.findUnique({
      where: { pageId },
    });
    if (originalLayout) {
      await prisma.pageLayout.create({
        data: {
          pageId: copy.id,
          layoutData: originalLayout.layoutData as any,
        },
      });
    }
  } catch (e) {
    // If PageLayout table doesn't exist or duplication fails,
    // we still return the duplicated page without layout.
    console.error("Failed to duplicate page layout", e);
  }

  return NextResponse.json({ page: copy }, { status: 201 });
}

