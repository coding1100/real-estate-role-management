import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

function resolveAdminDisplaySlug(input: {
  slug: string;
  canonicalUrl: string | null;
}): string {
  const canonical = String(input.canonicalUrl ?? "").trim();
  if (!canonical) return `/${input.slug}`;
  try {
    const url =
      canonical.startsWith("http://") || canonical.startsWith("https://")
        ? new URL(canonical)
        : new URL(canonical, "https://placeholder.local");
    const canonicalPath = (url.pathname || "").trim();
    if (canonicalPath && canonicalPath !== "/") return canonicalPath;
  } catch {
    if (canonical.startsWith("/")) {
      const path = canonical.split("?")[0]?.split("#")[0] ?? "";
      if (path.trim()) return path.trim();
    }
  }
  return `/${input.slug}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const domainId = searchParams.get("domainId");
  if (!domainId) {
    return NextResponse.json(
      { error: "Missing domainId query parameter" },
      { status: 400 },
    );
  }

  try {
    const pages = await prisma.landingPage.findMany({
      where: {
        domainId,
        status: "published",
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        canonicalUrl: true,
        title: true,
        headline: true,
        type: true,
      },
      orderBy: { slug: "asc" },
    });

    return NextResponse.json({
      pages: pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        displaySlug: resolveAdminDisplaySlug({
          slug: p.slug,
          canonicalUrl: p.canonicalUrl,
        }),
        title: p.title ?? "",
        headline: p.headline ?? "",
        type: p.type,
      })),
    });
  } catch (error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : null;

    if (code === "ETIMEDOUT") {
      console.error(
        "[for-multistep] prisma.landingPage.findMany timed out while loading pages for domainId",
        { domainId, error },
      );
      return NextResponse.json(
        {
          error:
            "The database request timed out while loading pages for this domain. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    console.error(
      "[for-multistep] prisma.landingPage.findMany failed while loading pages for domainId",
      { domainId, error },
    );
    return NextResponse.json(
      { error: "Failed to load pages for this domain." },
      { status: 500 },
    );
  }
}
