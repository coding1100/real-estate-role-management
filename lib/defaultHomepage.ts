import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prismaRetry";

type DomainDefaultHomepageRow = {
  pageId: string;
  slug: string;
};

function isMissingColumnError(error: unknown): boolean {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;
  return code === "42703";
}

export async function getDomainDefaultHomepageSlug(
  domainId: string,
): Promise<string | null> {
  try {
    const rows = (await withPrismaRetry(() => prisma.$queryRaw<DomainDefaultHomepageRow[]>`
      SELECT lp."id" AS "pageId", lp."slug" AS "slug"
      FROM "Domain" d
      JOIN "LandingPage" lp ON lp."id" = d."defaultHomepagePageId"
      WHERE d."id" = ${domainId}
        AND lp."status" = 'published'
        AND lp."deletedAt" IS NULL
      LIMIT 1
    `)) as DomainDefaultHomepageRow[];
    return rows[0]?.slug ?? null;
  } catch (error) {
    if (!isMissingColumnError(error)) {
      console.error("[defaultHomepage] Failed to resolve default homepage slug", error);
    }
    return null;
  }
}

export async function isFixedDefaultHomepagePage(pageId: string): Promise<boolean> {
  try {
    const rows = (await withPrismaRetry(() => prisma.$queryRaw<{ id: string }[]>`
      SELECT d."id"
      FROM "Domain" d
      WHERE d."defaultHomepagePageId" = ${pageId}
      LIMIT 1
    `)) as { id: string }[];
    return rows.length > 0;
  } catch (error) {
    if (!isMissingColumnError(error)) {
      console.error("[defaultHomepage] Failed to check fixed homepage page", error);
    }
    return false;
  }
}

export async function getFixedHomepagePageIds(): Promise<Set<string>> {
  try {
    const rows = (await withPrismaRetry(() => prisma.$queryRaw<{ pageId: string }[]>`
      SELECT d."defaultHomepagePageId" AS "pageId"
      FROM "Domain" d
      WHERE d."defaultHomepagePageId" IS NOT NULL
    `)) as { pageId: string }[];
    return new Set(rows.map((row) => row.pageId).filter(Boolean));
  } catch (error) {
    if (!isMissingColumnError(error)) {
      console.error("[defaultHomepage] Failed to list fixed homepage ids", error);
    }
    return new Set();
  }
}

export async function validateDefaultHomepageSelection(
  domainId: string,
  pageId: string | null | undefined,
): Promise<string | null> {
  if (!pageId) return null;
  const trimmed = pageId.trim();
  if (!trimmed) return null;

  const rows = (await withPrismaRetry(() => prisma.$queryRaw<{ id: string }[]>`
    SELECT lp."id"
    FROM "LandingPage" lp
    WHERE lp."id" = ${trimmed}
      AND lp."domainId" = ${domainId}
      AND lp."status" = 'published'
      AND lp."deletedAt" IS NULL
    LIMIT 1
  `)) as { id: string }[];

  if (rows.length === 0) {
    throw new Error("Default homepage must be a published page from this domain.");
  }
  return rows[0].id;
}

export type DefaultHomepageButtonItem = {
  id: string;
  slug: string;
  title: string;
  heroImageUrl: string | null;
  href?: string | null;
  target?: "_self" | "_blank";
  styleMode?: "light" | "dark";
  ctaBgColor?: string;
  ctaTextColor?: string;
  ctaActiveBgColor?: string;
  ctaActiveTextColor?: string;
  isFeatured?: boolean;
};

export async function getDefaultHomepageButtons(
  domainId: string,
  excludePageId: string,
): Promise<DefaultHomepageButtonItem[]> {
  let limit = 9;
  try {
    const domainLimitRows = (await withPrismaRetry(() => prisma.$queryRaw<
      { defaultHomepageButtonLimit: number | null }[]
    >`
      SELECT d."defaultHomepageButtonLimit"
      FROM "Domain" d
      WHERE d."id" = ${domainId}
      LIMIT 1
    `)) as { defaultHomepageButtonLimit: number | null }[];
    const requestedLimit = Number(domainLimitRows[0]?.defaultHomepageButtonLimit ?? 9);
    limit = Math.max(
      1,
      Math.min(24, Number.isFinite(requestedLimit) ? requestedLimit : 9),
    );
  } catch (error) {
    if (!isMissingColumnError(error)) {
      console.error("[defaultHomepage] Failed to resolve button limit", error);
    }
  }

  const ordered = (await withPrismaRetry(() => prisma.$queryRaw<
    {
      id: string;
      slug: string;
      title: string | null;
      headline: string;
      heroImageUrl: string | null;
      adminListOrder: number;
    }[]
  >`
    SELECT lp."id",
           lp."slug",
           lp."title",
           lp."headline",
           lp."heroImageUrl",
           COALESCE(lp."adminListOrder", 0) AS "adminListOrder"
    FROM "LandingPage" lp
    WHERE lp."domainId" = ${domainId}
      AND lp."status" = 'published'
      AND lp."deletedAt" IS NULL
      AND lp."id" <> ${excludePageId}
    ORDER BY COALESCE(lp."adminListOrder", 0) ASC, lp."slug" ASC
    LIMIT ${limit}
  `)) as {
    id: string;
    slug: string;
    title: string | null;
    headline: string;
    heroImageUrl: string | null;
    adminListOrder: number;
  }[];

  type CustomHomepageButton = {
    id?: string;
    label?: string;
    href?: string;
    target?: string;
    styleMode?: string;
    ctaBgColor?: string;
    ctaTextColor?: string;
    ctaActiveBgColor?: string;
    ctaActiveTextColor?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    linkedPageId?: string;
  };
  const customRows = (await withPrismaRetry(() => prisma.$queryRaw<
    { defaultHomepageButtons: unknown }[]
  >`
    SELECT d."defaultHomepageButtons"
    FROM "Domain" d
    WHERE d."id" = ${domainId}
    LIMIT 1
  `)) as { defaultHomepageButtons: unknown }[];
  const rawCustomButtons = customRows[0]?.defaultHomepageButtons;
  const customButtons = Array.isArray(rawCustomButtons)
    ? (rawCustomButtons as CustomHomepageButton[])
    : [];
  const activeCustomButtons = customButtons.filter(
    (item) => item && item.isActive !== false,
  );

  if (activeCustomButtons.length > 0) {
    const limitedCustomButtons = activeCustomButtons.slice(0, limit);
    const pageById = new Map(ordered.map((row) => [row.id, row]));
    const slugById = new Map(ordered.map((row) => [row.id, row.slug]));
    const hrefToSlug = (href: string | undefined): string => {
      const normalized = String(href ?? "").trim();
      if (!normalized.startsWith("/")) return "";
      const path = normalized.split("?")[0]?.split("#")[0] ?? "";
      const slug = path.replace(/^\/+/, "").trim();
      return slug;
    };

    const usedIds = new Set<string>();
    return limitedCustomButtons.map((button, index) => {
      const linked = button.linkedPageId ? pageById.get(button.linkedPageId) : undefined;
      const href = (button.href ?? "").trim();
      const slugFromHref = hrefToSlug(href);
      const linkedSlug = button.linkedPageId ? slugById.get(button.linkedPageId) : "";
      const slug = linkedSlug || slugFromHref || "";
      const title =
        (button.label ?? "").trim() ||
        (linked?.title ?? "").trim() ||
        linked?.headline ||
        slug ||
        `Button ${index + 1}`;
      const target = button.target === "_blank" ? "_blank" : "_self";
      const styleMode = button.styleMode === "dark" ? "dark" : "light";
      const rawId = button.id?.trim() || `custom-${index + 1}`;
      let id = rawId;
      if (usedIds.has(id)) {
        id = `${rawId}-${index + 1}`;
      }
      usedIds.add(id);

      return {
        id,
        slug,
        title,
        heroImageUrl: linked?.heroImageUrl ?? null,
        href: href || (slug ? `/${slug}` : null),
        target,
        styleMode,
        ctaBgColor: (button.ctaBgColor ?? "").trim(),
        ctaTextColor: (button.ctaTextColor ?? "").trim(),
        ctaActiveBgColor: (button.ctaActiveBgColor ?? "").trim(),
        ctaActiveTextColor: (button.ctaActiveTextColor ?? "").trim(),
        isFeatured: button.isFeatured === true,
      };
    });
  }

  return ordered.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: (row.title ?? "").trim() || row.headline || row.slug,
    heroImageUrl: row.heroImageUrl ?? null,
    href: `/${row.slug}`,
    target: "_self",
    styleMode: "light",
    ctaBgColor: "",
    ctaTextColor: "",
    ctaActiveBgColor: "",
    ctaActiveTextColor: "",
    isFeatured: false,
  }));
}

export async function getDomainMasterBackgroundImage(
  domainId: string,
  pageType: string,
): Promise<string | null> {
  const extractMasterHeroBackground = (sections: unknown): string | null => {
    if (!Array.isArray(sections)) return null;
    const heroSection = sections.find(
      (section) =>
        section &&
        typeof section === "object" &&
        (section as { kind?: unknown }).kind === "hero",
    ) as { props?: unknown } | undefined;
    if (!heroSection || !heroSection.props || typeof heroSection.props !== "object") {
      return null;
    }
    const value = (heroSection.props as { homeBackgroundImageUrl?: unknown })
      .homeBackgroundImageUrl;
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const normalizedType = String(pageType ?? "").trim().toLowerCase();
  const masterSlug = normalizedType === "buyer" ? "master-buyer" : "master-seller";
  const masterType = normalizedType === "buyer" ? "buyer" : "seller";

  const rows = (await withPrismaRetry(() => prisma.$queryRaw<
    {
      heroImageUrl: string | null;
      sections: unknown;
    }[]
  >`
    SELECT lp."heroImageUrl", lp."sections"
    FROM "LandingPage" lp
    WHERE lp."domainId" = ${domainId}
      AND lp."slug" = ${masterSlug}
      AND lp."deletedAt" IS NULL
    ORDER BY CASE WHEN lp."status" = 'published' THEN 0 ELSE 1 END, lp."updatedAt" DESC
    LIMIT 1
  `)) as { heroImageUrl: string | null; sections: unknown }[];

  const fromSections = extractMasterHeroBackground(rows[0]?.sections);
  if (fromSections) return fromSections;

  const image = (rows[0]?.heroImageUrl ?? "").trim();
  if (image.length > 0) return image;

  // Fallback 1: any master page for this type across domains.
  const globalMasterRows = (await withPrismaRetry(() => prisma.$queryRaw<
    { heroImageUrl: string | null; sections: unknown }[]
  >`
    SELECT lp."heroImageUrl", lp."sections"
    FROM "LandingPage" lp
    WHERE lp."slug" = ${masterSlug}
      AND lp."deletedAt" IS NULL
    ORDER BY CASE WHEN lp."status" = 'published' THEN 0 ELSE 1 END, lp."updatedAt" DESC
    LIMIT 1
  `)) as { heroImageUrl: string | null; sections: unknown }[];

  const globalFromSections = extractMasterHeroBackground(
    globalMasterRows[0]?.sections,
  );
  if (globalFromSections) return globalFromSections;

  const globalImage = (globalMasterRows[0]?.heroImageUrl ?? "").trim();
  if (globalImage.length > 0) return globalImage;

  // Fallback 2: MasterTemplate.sections (locked buyer/seller template definition).
  const templateRows = (await withPrismaRetry(() => prisma.$queryRaw<{ sections: unknown }[]>`
    SELECT mt."sections"
    FROM "MasterTemplate" mt
    WHERE mt."type" = ${masterType}
    LIMIT 1
  `)) as { sections: unknown }[];
  const templateFromSections = extractMasterHeroBackground(templateRows[0]?.sections);
  if (templateFromSections) return templateFromSections;

  return null;
}

