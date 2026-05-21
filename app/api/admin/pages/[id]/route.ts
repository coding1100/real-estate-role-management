import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { isFixedDefaultHomepagePage } from "@/lib/defaultHomepage";
import { sanitizeCtaTitle, type CtaForwardingRule } from "@/lib/types/ctaForwarding";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function deriveSlugFromCanonicalUrl(canonicalUrl: string): string | null {
  const raw = canonicalUrl.trim();
  if (!raw) return null;

  let pathname = "";
  try {
    if (raw.startsWith("/")) {
      pathname = raw;
    } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      pathname = new URL(raw).pathname;
    } else {
      pathname = new URL(`https://${raw}`).pathname;
    }
  } catch {
    return null;
  }

  const normalized = pathname
    .trim()
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePageCtaForwardingRules(input: unknown): CtaForwardingRule[] {
  if (!Array.isArray(input)) return [];
  const normalized: CtaForwardingRule[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const ctaTitle = sanitizeCtaTitle(
      typeof (item as { ctaTitle?: unknown }).ctaTitle === "string"
        ? ((item as { ctaTitle: string }).ctaTitle)
        : "",
    );
    if (!ctaTitle) continue;
    const forwardUrl =
      typeof (item as { forwardUrl?: unknown }).forwardUrl === "string"
        ? (item as { forwardUrl: string }).forwardUrl.trim()
        : "";
    const forwardEnabled =
      typeof (item as { forwardEnabled?: unknown }).forwardEnabled === "boolean"
        ? (item as { forwardEnabled: boolean }).forwardEnabled
        : !!forwardUrl;
    const resendTemplateId =
      typeof (item as { resendTemplateId?: unknown }).resendTemplateId === "string"
        ? (item as { resendTemplateId: string }).resendTemplateId.trim()
        : "";
    const resendTemplateName =
      typeof (item as { resendTemplateName?: unknown }).resendTemplateName === "string"
        ? (item as { resendTemplateName: string }).resendTemplateName.trim()
        : "";
    const deliveryMode =
      (item as { deliveryMode?: unknown }).deliveryMode === "notify_only_form_data"
        ? "notify_only_form_data"
        : "documents_with_notify";
    if (forwardUrl && !/^https?:\/\//i.test(forwardUrl)) continue;
    normalized.push({
      ctaTitle,
      deliveryMode,
      ...(forwardUrl ? { forwardUrl } : {}),
      ...(forwardEnabled ? { forwardEnabled: true } : { forwardEnabled: false }),
      ...(resendTemplateId ? { resendTemplateId } : {}),
      ...(resendTemplateName ? { resendTemplateName } : {}),
      ...(deliveryMode === "documents_with_notify"
        ? {
            documents: Array.isArray((item as { documents?: unknown }).documents)
        ? ((item as { documents: unknown[] }).documents
            .filter((doc) => doc && typeof doc === "object")
            .map((doc) => {
              const name =
                typeof (doc as { name?: unknown }).name === "string"
                  ? (doc as { name: string }).name.trim()
                  : "";
              const url =
                typeof (doc as { url?: unknown }).url === "string"
                  ? (doc as { url: string }).url.trim()
                  : "";
              if (!name || !url || !/^https?:\/\//i.test(url)) return null;
              return {
                name,
                url,
                ...(typeof (doc as { autoSend?: unknown }).autoSend === "boolean"
                  ? { autoSend: (doc as { autoSend: boolean }).autoSend }
                  : {}),
                ...(typeof (doc as { mimeType?: unknown }).mimeType === "string" &&
                (doc as { mimeType: string }).mimeType.trim()
                  ? { mimeType: (doc as { mimeType: string }).mimeType.trim() }
                  : {}),
                ...(typeof (doc as { publicId?: unknown }).publicId === "string" &&
                (doc as { publicId: string }).publicId.trim()
                  ? { publicId: (doc as { publicId: string }).publicId.trim() }
                  : {}),
                ...(typeof (doc as { format?: unknown }).format === "string" &&
                (doc as { format: string }).format.trim()
                  ? { format: (doc as { format: string }).format.trim() }
                  : {}),
              };
            })
            .filter(
              (
                doc,
              ): doc is NonNullable<CtaForwardingRule["documents"]>[number] =>
                doc !== null,
            ))
        : [],
          }
        : {}),
      notifyEmails: Array.isArray((item as { notifyEmails?: unknown }).notifyEmails)
        ? ((item as { notifyEmails: unknown[] }).notifyEmails
            .filter((email) => email && typeof email === "object")
            .map((email) => {
              const address =
                typeof (email as { email?: unknown }).email === "string"
                  ? (email as { email: string }).email.trim()
                  : "";
              if (!address) return null;
              return {
                email: address,
                ...(typeof (email as { enabled?: unknown }).enabled === "boolean"
                  ? { enabled: (email as { enabled: boolean }).enabled }
                  : {}),
                ...(typeof (email as { kind?: unknown }).kind === "string" &&
                ((email as { kind: string }).kind === "cc" ||
                  (email as { kind: string }).kind === "bcc")
                  ? { kind: (email as { kind: "cc" | "bcc" }).kind }
                  : {}),
              };
            })
            .filter(
              (
                entry,
              ): entry is NonNullable<CtaForwardingRule["notifyEmails"]>[number] =>
                entry !== null,
            ))
        : [],
    });
  }
  return normalized;
}

type ToastThemeOverridePayload = {
  position?: "top-right" | "top-left" | "top-center" | "bottom-right" | "bottom-left" | "bottom-center";
  durationMs?: number;
  successBg?: string;
  successText?: string;
  errorBg?: string;
  errorText?: string;
  alertBg?: string;
  alertText?: string;
  infoBg?: string;
  infoText?: string;
  iconSize?: number;
  successTitle?: string;
  successBody?: string;
  errorTitle?: string;
  errorBody?: string;
  alertTitle?: string;
  alertBody?: string;
};

function normalizeToastThemeOverride(
  input: unknown,
): ToastThemeOverridePayload | null {
  if (input == null) return null;
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;
  const normalized: ToastThemeOverridePayload = {};
  const position = source.position;
  if (
    position === "top-right" ||
    position === "top-left" ||
    position === "top-center" ||
    position === "bottom-right" ||
    position === "bottom-left" ||
    position === "bottom-center"
  ) {
    normalized.position = position;
  }
  const durationMsRaw = source.durationMs;
  if (typeof durationMsRaw === "number" && Number.isFinite(durationMsRaw)) {
    normalized.durationMs = Math.min(30000, Math.max(1000, Math.floor(durationMsRaw)));
  }
  const iconSizeRaw = source.iconSize;
  if (typeof iconSizeRaw === "number" && Number.isFinite(iconSizeRaw)) {
    normalized.iconSize = Math.min(40, Math.max(14, Math.floor(iconSizeRaw)));
  }
  const stringKeys: Array<keyof ToastThemeOverridePayload> = [
    "successBg",
    "successText",
    "errorBg",
    "errorText",
    "alertBg",
    "alertText",
    "infoBg",
    "infoText",
    "successTitle",
    "successBody",
    "errorTitle",
    "errorBody",
    "alertTitle",
    "alertBody",
  ];
  for (const key of stringKeys) {
    const value = source[key];
    if (typeof value === "string") {
      (normalized as Record<string, unknown>)[key] = value.trim();
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id } = await ctx.params;
  const isFixedDefaultHomepage = await isFixedDefaultHomepagePage(id);
  const hasNotesInBody = Object.prototype.hasOwnProperty.call(body, "notes");
  const hasMultistepNotifyEachStepInBody = Object.prototype.hasOwnProperty.call(
    body,
    "multistepNotifyEachStep",
  );
  let normalizedNotesValue: string | null = null;

  if (hasNotesInBody) {
    if (body.notes === null) {
      normalizedNotesValue = null;
    } else if (typeof body.notes === "string") {
      const normalizedNotes = body.notes.trim();
      normalizedNotesValue = normalizedNotes.length > 0 ? normalizedNotes : null;
    } else {
      return NextResponse.json(
        { error: "notes must be a string or null." },
        { status: 400 },
      );
    }
    // Save notes through SQL to avoid Prisma client/schema mismatch issues.
    delete body.notes;
  }
  if (hasMultistepNotifyEachStepInBody) {
    if (typeof body.multistepNotifyEachStep !== "boolean") {
      return NextResponse.json(
        { error: "multistepNotifyEachStep must be a boolean." },
        { status: 400 },
      );
    }
  }

  let existingPage:
    | {
        domainId: string;
        canonicalUrl: string | null;
        slug: string;
        deletedAt: Date | null;
        archivedSlug: string | null;
      }
    | null = null;
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        domainId: string;
        canonicalUrl: string | null;
        slug: string;
        deletedAt: Date | null;
        archivedSlug: string | null;
      }>
    >`
      SELECT
        "domainId",
        "canonicalUrl",
        "slug",
        "deletedAt",
        "archivedSlug"
      FROM "LandingPage"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    existingPage = rows[0] ?? null;
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
        "[pages] prisma.landingPage.findUnique timed out while loading page for PATCH",
        { id, error },
      );
      return NextResponse.json(
        {
          error:
            "The database request timed out while loading this page. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    const dbCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : null;
    if (dbCode === "42703") {
      return NextResponse.json(
        {
          error:
            'Soft-delete columns are missing. Run:\nALTER TABLE "LandingPage" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedBy" TEXT, ADD COLUMN "archivedSlug" TEXT;',
        },
        { status: 500 },
      );
    }

    console.error("[pages] Failed while loading page for PATCH", { id, error });
    return NextResponse.json(
      { error: "Failed to load page from the database." },
      { status: 500 },
    );
  }
  if (!existingPage) {
    return NextResponse.json({ error: "Page not found." }, { status: 404 });
  }
  const currentDomain = await prisma.domain.findUnique({
    where: { id: existingPage.domainId },
    select: { hostname: true },
  });
  if (!currentDomain || !currentDomain.hostname) {
    return NextResponse.json(
      { error: "Domain not found for this page." },
      { status: 400 },
    );
  }

  if (body.action === "restore") {
    if (!existingPage.deletedAt) {
      return NextResponse.json(
        { error: "Page is already active." },
        { status: 400 },
      );
    }

    const rawBaseSlug = (existingPage.archivedSlug || existingPage.slug || "").trim();
    const normalizedBaseSlug = normalizeSlug(rawBaseSlug || "restored-page");
    let resolvedSlug = normalizedBaseSlug;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate =
        attempt === 0
          ? normalizedBaseSlug
          : attempt === 1
            ? `${normalizedBaseSlug}-restored`
            : `${normalizedBaseSlug}-restored-${attempt}`;
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "LandingPage"
        WHERE "domainId" = ${existingPage.domainId}
          AND "slug" = ${candidate}
          AND "deletedAt" IS NULL
          AND "id" <> ${id}
        LIMIT 1
      `;
      if (rows.length === 0) {
        resolvedSlug = candidate;
        break;
      }
    }

    await prisma.$executeRaw`
      UPDATE "LandingPage"
      SET "deletedAt" = NULL,
          "deletedBy" = NULL,
          "archivedSlug" = NULL,
          "slug" = ${resolvedSlug},
          "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;

    const restoredPage = await prisma.landingPage.findUnique({
      where: { id },
    });
    if (!restoredPage) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    revalidatePath(`/${restoredPage.slug}`);
    revalidatePath("/");
    return NextResponse.json(
      {
        page: restoredPage,
        restoredSlug: restoredPage.slug,
      },
      { status: 200 },
    );
  }
  delete body.action;

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (body.status !== "draft" && body.status !== "published") {
      return NextResponse.json(
        { error: 'status must be either "draft" or "published".' },
        { status: 400 },
      );
    }
    if (isFixedDefaultHomepage && body.status === "draft") {
      return NextResponse.json(
        {
          error:
            "This page is the fixed domain default homepage and cannot be unpublished.",
        },
        { status: 400 },
      );
    }
  }

  // Keep slug and canonical URL path in strict sync.
  const hasCanonicalInBody = Object.prototype.hasOwnProperty.call(body, "canonicalUrl");
  const hasSlugInBody = Object.prototype.hasOwnProperty.call(body, "slug");
  if (hasCanonicalInBody && typeof body.canonicalUrl === "string") {
    const derivedSlug = deriveSlugFromCanonicalUrl(body.canonicalUrl);
    if (derivedSlug) {
      body.slug = derivedSlug;
      body.canonicalUrl = `https://${currentDomain.hostname}/${derivedSlug}`;
    }
  } else if (hasCanonicalInBody && body.canonicalUrl == null && hasSlugInBody) {
    const rawSlug = typeof body.slug === "string" ? body.slug : "";
    const normalized = normalizeSlug(rawSlug);
    if (normalized) {
      body.slug = normalized;
      body.canonicalUrl = `https://${currentDomain.hostname}/${normalized}`;
    }
  }

  // Basic validation for slug updates
  if (Object.prototype.hasOwnProperty.call(body, "slug")) {
    if (typeof body.slug !== "string" || body.slug.trim().length === 0) {
      return NextResponse.json(
        { error: "Slug cannot be empty." },
        { status: 400 },
      );
    }
    const normalizedSlug = body.slug.trim().toLowerCase();

    // Enforce global uniqueness: slug must be unique across all domains/pages.
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "LandingPage"
      WHERE "slug" = ${normalizedSlug}
        AND "id" <> ${id}
        AND "deletedAt" IS NULL
      LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json(
        {
          error:
            "A page with this slug already exists. Please choose a different slug.",
        },
        { status: 400 },
      );
    }

    body.slug = normalizedSlug;
    body.canonicalUrl = `https://${currentDomain.hostname}/${normalizedSlug}`;
  }

  try {
    // If we are renaming the legacy /strategy-call page and it uses the
    // Next steps layout without an explicit profile-only flag, backfill
    // that flag into the hero section so the layout stays stable after rename.
    if (typeof body.slug === "string") {
      const existing = await prisma.landingPage.findUnique({
        where: { id },
        select: { slug: true, sections: true },
      });
      if (existing && existing.slug === "strategy-call") {
        const rawSections = existing.sections as any;
        const sections: any[] = Array.isArray(rawSections)
          ? rawSections
          : [];
        const heroIdx = sections.findIndex((s) => s && s.kind === "hero");
        if (heroIdx !== -1) {
          const hero = sections[heroIdx] || {};
          const props = (hero.props || {}) as any;
          if (
            props.formStyle === "next-steps" &&
            typeof props.nextStepsSecondOnly === "undefined"
          ) {
            const updatedHero = {
              ...hero,
              props: {
                ...props,
                nextStepsSecondOnly: true,
              },
            };
            sections[heroIdx] = updatedHero;
            if (!Object.prototype.hasOwnProperty.call(body, "sections")) {
              body.sections = sections;
            }
          }
        }
      }
    }

    // Extract layout data if provided
    const layoutData = body.layoutData;
    delete body.layoutData;
    if (isFixedDefaultHomepage && Array.isArray(layoutData) && layoutData.length > 0) {
      return NextResponse.json(
        {
          error:
            "Layout is fixed for this domain default homepage and cannot be changed.",
        },
        { status: 400 },
      );
    }

    // Persist per-page social icon overrides into the hero section props
    if (Object.prototype.hasOwnProperty.call(body, "socialOverrides")) {
      const socialOverrides = body.socialOverrides;
      try {
        const existing = await prisma.landingPage.findUnique({
          where: { id },
          select: { sections: true },
        });
        const rawSections = (body.sections ?? existing?.sections) as any;
        const sections: any[] = Array.isArray(rawSections) ? [...rawSections] : [];
        const heroIdx = sections.findIndex((s) => s && s.kind === "hero");
        if (heroIdx !== -1) {
          const hero = sections[heroIdx] || {};
          sections[heroIdx] = {
            ...hero,
            props: {
              ...(hero.props || {}),
              socialOverrides,
            },
          };
          body.sections = sections;
        } else {
          // If no hero section exists (rare), create one so social overrides persist.
          sections.push({
            id: "hero",
            kind: "hero",
            props: { socialOverrides },
          });
          body.sections = sections;
        }
      } catch {
        // ignore failures; fall back to saving without social overrides
      }
      delete body.socialOverrides;
    }
    if (Object.prototype.hasOwnProperty.call(body, "multistepNotifyEachStep")) {
      const notifyEachStep = body.multistepNotifyEachStep === true;
      const existing = await prisma.landingPage.findUnique({
        where: { id },
        select: { sections: true },
      });
      const rawSections = body.sections ?? existing?.sections;
      const sections: unknown[] = Array.isArray(rawSections) ? [...rawSections] : [];
      const heroIdx = sections.findIndex(
        (section) =>
          section &&
          typeof section === "object" &&
          (section as { kind?: unknown }).kind === "hero",
      );
      if (heroIdx !== -1) {
        const heroSection = sections[heroIdx] as {
          props?: unknown;
          [key: string]: unknown;
        };
        const heroProps =
          heroSection.props && typeof heroSection.props === "object"
            ? (heroSection.props as Record<string, unknown>)
            : {};
        sections[heroIdx] = {
          ...heroSection,
          props: {
            ...heroProps,
            multistepNotifyEachStep: notifyEachStep,
          },
        };
      } else {
        sections.push({
          id: "hero",
          kind: "hero",
          props: { multistepNotifyEachStep: notifyEachStep },
        });
      }
      body.sections = sections;
      delete body.multistepNotifyEachStep;
    }

    if (Object.prototype.hasOwnProperty.call(body, "ctaForwardingRules")) {
      const normalizedCtaRules = normalizePageCtaForwardingRules(body.ctaForwardingRules);
      const existing = await prisma.landingPage.findUnique({
        where: { id },
        select: { sections: true },
      });
      const rawSections = body.sections ?? existing?.sections;
      const sections: unknown[] = Array.isArray(rawSections) ? [...rawSections] : [];
      const heroIdx = sections.findIndex(
        (section) =>
          section &&
          typeof section === "object" &&
          (section as { kind?: unknown }).kind === "hero",
      );
      if (heroIdx !== -1) {
        const heroSection = sections[heroIdx] as {
          id?: unknown;
          kind?: unknown;
          props?: unknown;
          [key: string]: unknown;
        };
        const heroProps =
          heroSection.props && typeof heroSection.props === "object"
            ? (heroSection.props as Record<string, unknown>)
            : {};
        sections[heroIdx] = {
          ...heroSection,
          props: {
            ...heroProps,
            ctaForwardingRules: normalizedCtaRules,
          },
        };
      } else {
        sections.push({
          id: "hero",
          kind: "hero",
          props: { ctaForwardingRules: normalizedCtaRules },
        });
      }
      body.sections = sections;
      delete body.ctaForwardingRules;
    }

    if (Object.prototype.hasOwnProperty.call(body, "toastThemeOverride")) {
      const normalizedToastThemeOverride = normalizeToastThemeOverride(
        body.toastThemeOverride,
      );
      const existing = await prisma.landingPage.findUnique({
        where: { id },
        select: { sections: true },
      });
      const rawSections = body.sections ?? existing?.sections;
      const sections: unknown[] = Array.isArray(rawSections) ? [...rawSections] : [];
      const heroIdx = sections.findIndex(
        (section) =>
          section &&
          typeof section === "object" &&
          (section as { kind?: unknown }).kind === "hero",
      );
      if (heroIdx !== -1) {
        const heroSection = sections[heroIdx] as {
          id?: unknown;
          kind?: unknown;
          props?: unknown;
          [key: string]: unknown;
        };
        const heroProps =
          heroSection.props && typeof heroSection.props === "object"
            ? (heroSection.props as Record<string, unknown>)
            : {};
        const nextProps = { ...heroProps };
        if (normalizedToastThemeOverride) {
          nextProps.toastThemeOverride = normalizedToastThemeOverride;
        } else {
          delete nextProps.toastThemeOverride;
        }
        sections[heroIdx] = {
          ...heroSection,
          props: nextProps,
        };
      } else if (normalizedToastThemeOverride) {
        sections.push({
          id: "hero",
          kind: "hero",
          props: { toastThemeOverride: normalizedToastThemeOverride },
        });
      }
      body.sections = sections;
      delete body.toastThemeOverride;
    }

    console.log("[PATCH] Updating page:", id);
    console.log("[PATCH] Body keys:", Object.keys(body));
    console.log("[PATCH] Headline:", body.headline);

    // Bookmark toggle: update via SQL so it works even if Prisma client
    // hasn't been regenerated yet after a manual DB ALTER TABLE.
    if (Object.prototype.hasOwnProperty.call(body, "bookmarked")) {
      if (typeof body.bookmarked !== "boolean") {
        return NextResponse.json(
          { error: "bookmarked must be a boolean." },
          { status: 400 },
        );
      }
      await prisma.$executeRaw`
        UPDATE "LandingPage"
        SET "bookmarked" = ${body.bookmarked}, "updatedAt" = NOW()
        WHERE "id" = ${id}
      `;
      delete body.bookmarked;
    }

    if (hasNotesInBody) {
      try {
        await prisma.$executeRaw`
          UPDATE "LandingPage"
          SET "notes" = ${normalizedNotesValue}, "updatedAt" = NOW()
          WHERE "id" = ${id}
        `;
      } catch (error: unknown) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof (error as { code?: unknown }).code === "string"
            ? (error as { code: string }).code
            : null;

        // Postgres undefined_column (usually migration not applied).
        if (code === "42703") {
          return NextResponse.json(
            {
              error:
                'Notes column is not available in the database yet. Run migrations (e.g. "npx prisma migrate deploy") and try again.',
            },
            { status: 500 },
          );
        }

        throw error;
      }
    }

    // Update the page
    const page =
      Object.keys(body).length > 0
        ? await prisma.landingPage.update({
            where: { id },
            data: {
              ...body,
            },
          })
        : await prisma.landingPage.findUniqueOrThrow({ where: { id } });

    console.log("[PATCH] Updated page:", page.slug, "headline:", page.headline);

    if (layoutData && Array.isArray(layoutData) && layoutData.length > 0) {
      await prisma.pageLayout.upsert({
        where: { pageId: id },
        update: { layoutData: layoutData },
        create: { pageId: id, layoutData: layoutData },
      });
    }

    // Revalidate the page cache so changes appear immediately on frontend
    console.log("[revalidate] Triggering cache invalidation for:", page.slug);
    if (page.slug) {
      // Revalidate the slug path
      revalidatePath(`/${page.slug}`);
      revalidatePath("/");
      // Also try domain-specific paths
      revalidatePath(`/${page.slug}`);
    }

    // Also need to revalidate the domain page if it exists
    if (page.domainId) {
      try {
        const domain = await prisma.domain.findUnique({
          where: { id: page.domainId },
        });
        if (domain) {
          console.log(
            "[revalidate] Also invalidating domain path:",
            `/${domain.hostname}/${page.slug}`,
          );
          revalidatePath(`/${domain.hostname}/${page.slug}`);
        }
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
            "[revalidate] prisma.domain.findUnique timed out while loading domain for cache invalidation",
            { domainId: page.domainId, slug: page.slug, error },
          );
        } else {
          console.error(
            "[revalidate] prisma.domain.findUnique failed while loading domain for cache invalidation",
            { domainId: page.domainId, slug: page.slug, error },
          );
        }
        // Do not fail the PATCH response if cache invalidation for the domain path fails.
      }
    }
    console.log("[revalidate] Cache invalidation complete");

    return NextResponse.json({ page }, { status: 200 });
  } catch (err: any) {
    // Handle unique constraint violation on (domainId, slug)
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Slug already exists for this domain." },
        { status: 400 },
      );
    }

    console.error(err);
    return NextResponse.json(
      { error: "Failed to update page." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const isFixedDefaultHomepage = await isFixedDefaultHomepagePage(id);
  if (isFixedDefaultHomepage) {
    return NextResponse.json(
      { error: "This domain default homepage is fixed and cannot be deleted." },
      { status: 400 },
    );
  }

  try {
    // Load the page to get its slug.
    const pageRows = await prisma.$queryRaw<
      Array<{ id: string; slug: string; deletedAt: Date | null }>
    >`
      SELECT "id", "slug", "deletedAt"
      FROM "LandingPage"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const pageToDelete = pageRows[0] ?? null;
    if (!pageToDelete) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }
    if (pageToDelete.deletedAt) {
      const isPermanent = req.nextUrl.searchParams.get("permanent") === "1";
      if (!isPermanent) {
        return NextResponse.json(
          { error: "Page is already archived." },
          { status: 400 },
        );
      }

      await prisma.$transaction([
        prisma.lead.deleteMany({ where: { pageId: id } }),
        prisma.pageLayout.deleteMany({ where: { pageId: id } }),
        prisma.landingPage.delete({ where: { id } }),
      ]);
      return NextResponse.json({ ok: true, deleted: "permanent" }, { status: 200 });
    }

    // If we have a slug, scan for any entry pages whose multistepStepSlugs
    // array includes this slug. We do this filtering in application code to
    // avoid relying on provider-specific JSON operators.
    if (pageToDelete?.slug) {
      const potentialReferrers = await prisma.landingPage.findMany({
        // We intentionally avoid provider-specific JSON filters here and
        // perform the null/array checks in application code below.
        select: {
          id: true,
          slug: true,
          multistepStepSlugs: true,
        },
      });

      const usedInMultistep = potentialReferrers.filter((p) => {
        const slugs = (p.multistepStepSlugs as any) as string[] | null;
        return Array.isArray(slugs) && slugs.includes(pageToDelete.slug);
      });

      if (usedInMultistep.length > 0) {
        return NextResponse.json(
          {
            error:
              "This page is used in a multistep flow. Remove it from all multistep flows before deleting.",
          },
          { status: 400 },
        );
      }
    }

    const archivedSlugValue = `${pageToDelete.slug}--archived-${pageToDelete.id.slice(
      0,
      8,
    )}-${Date.now()}`;
    await prisma.$executeRaw`
      UPDATE "LandingPage"
      SET "deletedAt" = NOW(),
          "deletedBy" = ${session.user?.email ?? "admin"},
          "archivedSlug" = COALESCE("archivedSlug", "slug"),
          "slug" = ${archivedSlugValue},
          "status" = 'draft',
          "updatedAt" = NOW()
      WHERE "id" = ${id}
        AND "deletedAt" IS NULL
    `;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const code =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof (err as { code?: unknown }).code === "string"
        ? ((err as { code: string }).code)
        : null;
    if (code === "42703") {
      return NextResponse.json(
        {
          error:
            'Soft-delete columns are missing. Run:\nALTER TABLE "LandingPage" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedBy" TEXT, ADD COLUMN "archivedSlug" TEXT;',
        },
        { status: 500 },
      );
    }
    console.error(err);
    return NextResponse.json(
      {
        error:
          "Failed to delete page. There may be related data blocking delete.",
      },
      { status: 500 },
    );
  }
}

