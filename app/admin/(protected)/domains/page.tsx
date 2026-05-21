import { prisma } from "@/lib/prisma";
import { DomainsManager } from "@/components/admin/DomainsManager";
import { safePrismaRead, withPrismaRetry } from "@/lib/prismaRetry";

export default async function DomainsPage() {
  const resolveDisplayPath = (slug: string, canonicalUrl: string | null): string => {
    const canonical = String(canonicalUrl ?? "").trim();
    if (!canonical) return `/${slug}`;
    try {
      const url = canonical.startsWith("http://") || canonical.startsWith("https://")
        ? new URL(canonical)
        : new URL(canonical, "https://placeholder.local");
      const path = (url.pathname || "").trim();
      if (path && path !== "/") return path;
    } catch {
      if (canonical.startsWith("/")) {
        const path = canonical.split("?")[0]?.split("#")[0] ?? "";
        if (path.trim()) return path.trim();
      }
    }
    return `/${slug}`;
  };
  const domains = await safePrismaRead(
    "domains:domain.findMany",
    () =>
      prisma.domain.findMany({
        orderBy: { hostname: "asc" },
      }),
    [],
  );
  let defaultRows: {
    id: string;
    defaultHomepagePageId: string | null;
    defaultHomepageButtonLimit: number | null;
  }[] = [];
  try {
    defaultRows = await withPrismaRetry(() => prisma.$queryRaw<
      {
        id: string;
        defaultHomepagePageId: string | null;
        defaultHomepageButtonLimit: number | null;
      }[]
    >`
      SELECT d."id", d."defaultHomepagePageId", d."defaultHomepageButtonLimit"
      FROM "Domain" d
    `);
  } catch (error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;
    if (code === "42703") {
      const fallbackRows = await safePrismaRead(
        "domains:defaultHomepage fallback query",
        () =>
          withPrismaRetry(() =>
            prisma.$queryRaw<{ id: string; defaultHomepagePageId: string | null }[]>`
              SELECT d."id", d."defaultHomepagePageId"
              FROM "Domain" d
            `,
          ),
        [],
      );
      defaultRows = fallbackRows.map((row) => ({
        ...row,
        defaultHomepageButtonLimit: 9,
      }));
    } else {
      console.error("[domains] Failed to load default homepage rows. Using empty defaults.", error);
      defaultRows = [];
    }
  }
  const defaultByDomainId = new Map<
    string,
    { pageId: string | null; buttonLimit: number }
  >(
    defaultRows.map((row) => [
      row.id,
      {
        pageId: row.defaultHomepagePageId ?? null,
        buttonLimit: Number(row.defaultHomepageButtonLimit ?? 9) || 9,
      },
    ]),
  );

  const publishedPages = await safePrismaRead(
    "domains:landingPage.findMany",
    () =>
      prisma.landingPage.findMany({
        where: { status: "published", deletedAt: null },
        select: {
          id: true,
          slug: true,
          canonicalUrl: true,
          title: true,
          headline: true,
          domainId: true,
        },
        orderBy: [{ domainId: "asc" }, { adminListOrder: "asc" }, { slug: "asc" }],
      }),
    [],
  );
  const pageOptionsByDomain = new Map<
    string,
    { id: string; slug: string; label: string; path: string }[]
  >();
  for (const page of publishedPages) {
    const current = pageOptionsByDomain.get(page.domainId) ?? [];
    current.push({
      id: page.id,
      slug: page.slug,
      label: (page.title ?? "").trim() || page.headline || page.slug,
      path: resolveDisplayPath(page.slug, page.canonicalUrl),
    });
    pageOptionsByDomain.set(page.domainId, current);
  }

  const normalizeHomepageButtons = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === "object")
      .map((item, index) => {
        const obj = item as Record<string, unknown>;
        const target: "_self" | "_blank" =
          obj.target === "_blank" ? "_blank" : "_self";
        const styleMode: "light" | "dark" =
          obj.styleMode === "dark" ? "dark" : "light";
        return {
          id: String(obj.id ?? `btn-${index + 1}`),
          label: String(obj.label ?? ""),
          href: String(obj.href ?? ""),
          target,
          styleMode,
          ctaBgColor: String(obj.ctaBgColor ?? ""),
          ctaTextColor: String(obj.ctaTextColor ?? ""),
          ctaActiveBgColor: String(obj.ctaActiveBgColor ?? ""),
          ctaActiveTextColor: String(obj.ctaActiveTextColor ?? ""),
          isActive: obj.isActive !== false,
          isFeatured: obj.isFeatured === true,
          linkedPageId:
            obj.linkedPageId != null ? String(obj.linkedPageId) : null,
        };
      });
  };

  type DomainRow = (typeof domains)[number];
  const initialDomains = domains.map((d: DomainRow) => ({
    id: d.id || "",
    hostname: d.hostname,
    displayName: d.displayName,
    notifyEmail: d.notifyEmail,
    notifySms: d.notifySms,
    isActive: d.isActive,
    ga4Id: d.ga4Id,
    metaPixelId: d.metaPixelId,
    logoUrl: d.logoUrl,
    rightLogoUrl: d.agentPhoto ?? null,
    faviconUrl: d.faviconUrl ?? null,
    linkedinUrl: d.linkedinUrl ?? null,
    linkedinVisible: d.linkedinVisible ?? true,
    googleUrl: d.googleUrl ?? null,
    googleVisible: d.googleVisible ?? true,
    facebookUrl: d.facebookUrl ?? null,
    facebookVisible: d.facebookVisible ?? true,
    instagramUrl: d.instagramUrl ?? null,
    instagramVisible: d.instagramVisible ?? true,
    zillowUrl: d.zillowUrl ?? null,
    zillowVisible: d.zillowVisible ?? true,
    defaultHomepagePageId: defaultByDomainId.get(d.id)?.pageId ?? null,
    defaultHomepageButtonLimit: defaultByDomainId.get(d.id)?.buttonLimit ?? 9,
    defaultHomepageOptions: pageOptionsByDomain.get(d.id) ?? [],
    defaultHomepageButtons: normalizeHomepageButtons(d.defaultHomepageButtons),
  }));

  return <DomainsManager initialDomains={initialDomains} />;
}

