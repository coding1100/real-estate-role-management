import { notFound, redirect } from "next/navigation";
import { prisma } from "./prisma";
import { withPrismaRetry } from "./prismaRetry";
import type { LandingPageContent } from "./types/page";
import { getDomainDefaultHomepageSlug } from "./defaultHomepage";
import {
  getDefaultHomepageButtons,
  getDomainMasterBackgroundImage,
  isFixedDefaultHomepagePage,
} from "./defaultHomepage";

// Fixed multistep flow for market report
const MARKET_REPORT_ENTRY_SLUG = "market-report";
const MARKET_REPORT_STEP_SLUGS = [
  "market-report-1",
  "market-report-2",
  "market-report-3",
] as const;

// Fixed multistep flow for executive relocation guide
const EXEC_REL_ENTRY_SLUG = "executive-relocation-guide";
const EXEC_REL_STEP_SLUGS = [
  "executive-relocation-guide-1",
  "executive-relocation-guide-2",
  "executive-relocation-guide-3-(Thankyou)",
] as const;

type PageRow = Awaited<
  ReturnType<typeof prisma.landingPage.findFirst<{ include: { domain: true } }>>
>;

function getCanonicalPathFromUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw)
        : new URL(raw, "https://placeholder.local");
    const path = (parsed.pathname || "").trim();
    if (!path || path === "/") return null;
    return path.replace(/^\/+|\/+$/g, "");
  } catch {
    if (!raw.startsWith("/")) return null;
    const path = raw.split("?")[0]?.split("#")[0]?.trim() ?? "";
    if (!path || path === "/") return null;
    return path.replace(/^\/+|\/+$/g, "");
  }
}

function matchesCanonicalPath(canonicalUrl: string | null | undefined, slug: string): boolean {
  const canonicalPath = getCanonicalPathFromUrl(canonicalUrl);
  if (!canonicalPath) return false;
  return canonicalPath.toLowerCase() === slug.trim().toLowerCase();
}

function pageToContent(
  page: NonNullable<PageRow>,
  pageLayout: { layoutData: unknown } | null,
): LandingPageContent {
  const rawSections = page.sections as any;
  const sections: any[] = Array.isArray(rawSections) ? rawSections : [];

  // Backfill Next-steps "profile-only" flag for legacy strategy-call pages.
  // This keeps the 1-column layout stable even after we stop keying off the slug,
  // and allows future renames to rely purely on this flag.
  if (page.slug === "strategy-call" && Array.isArray(sections)) {
    const heroIdx = sections.findIndex((s) => s && s.kind === "hero");
    if (heroIdx !== -1) {
      const hero = sections[heroIdx] || {};
      const props = (hero.props || {}) as any;
      if (
        props.formStyle === "next-steps" &&
        typeof props.nextStepsSecondOnly === "undefined"
      ) {
        sections[heroIdx] = {
          ...hero,
          props: {
            ...props,
            nextStepsSecondOnly: true,
          },
        };
      }
    }
  }

  // Derive per-page social overrides from hero section props, if present
  let socialOverrides: any = null;
  let toastThemeOverride: any = null;
  if (Array.isArray(sections)) {
    const hero = sections.find((s) => s && s.kind === "hero");
    if (hero && (hero as any).props && (hero as any).props.socialOverrides) {
      socialOverrides = (hero as any).props.socialOverrides;
    }
    if (hero && (hero as any).props && (hero as any).props.toastThemeOverride) {
      toastThemeOverride = (hero as any).props.toastThemeOverride;
    }
  }
  const heroForStepNotify = Array.isArray(sections)
    ? sections.find((s) => s && s.kind === "hero")
    : null;
  const multistepNotifyEachStep = Boolean(
    (heroForStepNotify as any)?.props?.multistepNotifyEachStep ??
      (page as { multistepNotifyEachStep?: boolean }).multistepNotifyEachStep,
  );

  return {
    id: page.id,
    slug: page.slug,
    title: (page as any).title ?? null,
    type: page.type as LandingPageContent["type"],
    headline: page.headline,
    subheadline: page.subheadline,
    heroImageUrl: page.heroImageUrl,
    ctaText: page.ctaText,
    successMessage: page.successMessage,
    footerHtml: (page as any).footerHtml ?? null,
    sections,
    formSchema: (page.formSchema as any) ?? null,
    socialOverrides,
    toastThemeOverride,
    domain: {
      hostname: page.domain.hostname,
      displayName: page.domain.displayName,
      logoUrl: page.domain.logoUrl,
      rightLogoUrl: page.domain.agentPhoto,
      primaryColor: page.domain.primaryColor,
      accentColor: page.domain.accentColor,
      ga4Id: page.domain.ga4Id,
      metaPixelId: page.domain.metaPixelId,
      faviconUrl: page.domain.faviconUrl ?? null,
      linkedinUrl: page.domain.linkedinUrl ?? null,
      linkedinVisible: page.domain.linkedinVisible ?? true,
      googleUrl: page.domain.googleUrl ?? null,
      googleVisible: page.domain.googleVisible ?? true,
      facebookUrl: page.domain.facebookUrl ?? null,
      facebookVisible: page.domain.facebookVisible ?? true,
      instagramUrl: page.domain.instagramUrl ?? null,
      instagramVisible: page.domain.instagramVisible ?? true,
      zillowUrl: page.domain.zillowUrl ?? null,
      zillowVisible: page.domain.zillowVisible ?? true,
    },
    seo: {
      title: page.seoTitle,
      description: page.seoDescription,
      keywords: (page.seoKeywords as any) ?? null,
      ogImageUrl: page.ogImageUrl,
      ogType: page.ogType,
      twitterCard: page.twitterCard,
      canonicalUrl: page.canonicalUrl,
      noIndex: page.noIndex,
      schemaMarkup: (page.schemaMarkup as any) ?? null,
      customHeadTags: (page.customHeadTags as any) ?? null,
    },
    pageLayout,
    multistepNotifyEachStep,
  };
}

/** Thrown when a slug exists on the domain but is not published and draft is not allowed. */
export class UnpublishedLandingPageError extends Error {
  readonly siteName: string;
  readonly hostname: string;
  readonly slug: string;

  constructor(siteName: string, hostname: string, slug: string) {
    super("UNPUBLISHED_LANDING_PAGE");
    this.name = "UnpublishedLandingPageError";
    this.siteName = siteName;
    this.hostname = hostname;
    this.slug = slug;
  }
}

/**
 * Resolves an unpublished error even when `instanceof` fails across bundles
 * (e.g. duplicate module instances in production).
 */
export function asUnpublishedLandingPageError(
  e: unknown,
): UnpublishedLandingPageError | null {
  if (e instanceof UnpublishedLandingPageError) return e;
  if (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: string }).name === "UnpublishedLandingPageError" &&
    typeof (e as { siteName?: unknown }).siteName === "string" &&
    typeof (e as { hostname?: unknown }).hostname === "string" &&
    typeof (e as { slug?: unknown }).slug === "string"
  ) {
    return e as UnpublishedLandingPageError;
  }
  return null;
}

export async function getLandingPage(
  hostname: string,
  slug: string,
  options?: {
    allowFallbackToAnyDomain?: boolean;
    includeDraft?: boolean;
    includeArchived?: boolean;
  },
): Promise<LandingPageContent> {
  const requestedSlug = slug;

  // Executive relocation: entry slug and first-step slug share the same content.
  // Fetch the canonical page row (first step) when entry URL is requested.
  const fetchSlug =
    requestedSlug === EXEC_REL_ENTRY_SLUG ? EXEC_REL_STEP_SLUGS[0] : requestedSlug;

  const includeDraft = options?.includeDraft === true;
  const includeArchived = options?.includeArchived === true;

  let page: PageRow | null = null;
  try {
    page = await withPrismaRetry(() =>
      prisma.landingPage.findFirst({
      where: {
        slug: fetchSlug,
        ...(includeArchived ? {} : { deletedAt: null }),
        ...(includeDraft ? {} : { status: "published" }),
        domain: {
          hostname,
          isActive: true,
        },
      },
      include: { domain: true },
    }),
    );
  } catch (err) {
    console.error("[getLandingPage] Primary query failed", err);
    page = null;
  }

  if (!page && options?.allowFallbackToAnyDomain) {
    try {
      // First, try to find a published page with this slug on any active domain.
      page = await withPrismaRetry(() =>
        prisma.landingPage.findFirst({
        where: {
          slug: fetchSlug,
          ...(includeArchived ? {} : { deletedAt: null }),
          ...(includeDraft ? {} : { status: "published" }),
          domain: { isActive: true },
        },
        include: { domain: true },
      }),
      );

      // If still not found, fall back to any status on any active domain.
      if (!page) {
        page = await withPrismaRetry(() =>
          prisma.landingPage.findFirst({
          where: {
            slug: fetchSlug,
            ...(includeArchived ? {} : { deletedAt: null }),
            domain: { isActive: true },
          },
          include: { domain: true },
        }),
        );
      }

      // Additional safety for executive relocation in preview environments.
      if (!page && requestedSlug === EXEC_REL_ENTRY_SLUG) {
        page = await withPrismaRetry(() =>
          prisma.landingPage.findFirst({
          where: {
            slug: EXEC_REL_ENTRY_SLUG,
            ...(includeArchived ? {} : { deletedAt: null }),
            domain: { isActive: true },
          },
          include: { domain: true },
        }),
        );
      }
    } catch (err) {
      console.error("[getLandingPage] Fallback query failed", err);
      page = null;
    }
  }

  if (!page) {
    try {
      const canonicalCandidates = await withPrismaRetry(() =>
        prisma.landingPage.findMany({
          where: {
            ...(includeArchived ? {} : { deletedAt: null }),
            ...(includeDraft ? {} : { status: "published" }),
            domain: {
              ...(options?.allowFallbackToAnyDomain
                ? { isActive: true }
                : { hostname, isActive: true }),
            },
            NOT: { canonicalUrl: null },
          },
          include: { domain: true },
        }),
      );
      page =
        canonicalCandidates.find((candidate) =>
          matchesCanonicalPath(
            (candidate as { canonicalUrl?: string | null }).canonicalUrl,
            fetchSlug,
          ),
        ) ?? null;
    } catch (err) {
      console.error("[getLandingPage] Canonical-path fallback failed", err);
    }
  }

  if (!page) {
    // Special-case master buyer/seller: if the dedicated landing page
    // does not exist, fall back to the master template preview routes.
    if (requestedSlug === "master-buyer") {
      redirect("/templates/master/buyer");
    }
    if (requestedSlug === "master-seller") {
      redirect("/templates/master/seller");
    }
    if (!includeDraft) {
      try {
        const draftRow = await withPrismaRetry(() =>
          prisma.landingPage.findFirst({
          where: {
            slug: fetchSlug,
            deletedAt: null,
            domain: { hostname, isActive: true },
            NOT: { status: "published" },
          },
          include: { domain: true },
        }),
        );
        if (draftRow?.domain) {
          throw new UnpublishedLandingPageError(
            draftRow.domain.displayName,
            draftRow.domain.hostname,
            requestedSlug,
          );
        }
      } catch (err) {
        if (asUnpublishedLandingPageError(err)) throw err;
        console.error("[getLandingPage] Unpublished check failed", err);
      }
    }
    notFound();
  }

  if (!page.domain) {
    notFound();
  }

  let stepSlugs = page.multistepStepSlugs as string[] | null;

  // If no explicit multistep configuration, infer steps for entry pages
  // with hard-coded multistep flows (market-report, executive relocation).
  // Use requestedSlug so both /executive-relocation-guide and /executive-relocation-guide-1 get steps.
  if (!stepSlugs || !Array.isArray(stepSlugs) || stepSlugs.length === 0) {
    const inferForEntry = async (
      _entrySlug: string,
      stepSlugList: readonly string[],
    ) => {
      const candidatePages = await withPrismaRetry(() =>
        prisma.landingPage.findMany({
        where: {
          slug: { in: stepSlugList as any },
          domainId: page.domainId,
          ...(includeArchived ? {} : { deletedAt: null }),
          ...(includeDraft ? {} : { status: "published" }),
        },
        select: { slug: true },
      }),
      );
      const existingSlugs = new Set(candidatePages.map((p) => p.slug));
      const inferred: string[] = [];
      for (const s of stepSlugList) {
        if (existingSlugs.has(s)) {
          inferred.push(s);
        }
      }
      return inferred;
    };

    if (requestedSlug === MARKET_REPORT_ENTRY_SLUG || page.slug === MARKET_REPORT_ENTRY_SLUG) {
      const inferred = await inferForEntry(
        MARKET_REPORT_ENTRY_SLUG,
        MARKET_REPORT_STEP_SLUGS,
      );
      if (inferred.length > 0) {
        stepSlugs = inferred;
      }
    } else if (
      requestedSlug === EXEC_REL_ENTRY_SLUG ||
      requestedSlug === EXEC_REL_STEP_SLUGS[0]
    ) {
      const inferred = await inferForEntry(
        EXEC_REL_ENTRY_SLUG,
        EXEC_REL_STEP_SLUGS,
      );
      if (inferred.length > 0) {
        stepSlugs = inferred;
      }
    }
  }

  let pageLayout: { layoutData: unknown } | null = null;
  try {
    const layout = await withPrismaRetry(() =>
      prisma.pageLayout.findUnique({
      where: { pageId: page.id },
      }),
    );
    if (layout) pageLayout = { layoutData: layout.layoutData };
  } catch {
    // PageLayout table may not exist if migration has not been applied
  }

  const content = pageToContent(page, pageLayout);
  const fixedDefaultHomepage = await isFixedDefaultHomepagePage(page.id);
  content.isFixedDefaultHomepage = fixedDefaultHomepage;
  if (fixedDefaultHomepage) {
    content.defaultHomepageButtons = await getDefaultHomepageButtons(
      page.domainId,
      page.id,
    );
    try {
      const masterBg = await getDomainMasterBackgroundImage(
        page.domainId,
        page.type,
      );
      if (masterBg) {
        const sections = Array.isArray(content.sections) ? [...content.sections] : [];
        const heroIndex = sections.findIndex((section) => section.kind === "hero");
        if (heroIndex !== -1) {
          const heroSection = sections[heroIndex];
          sections[heroIndex] = {
            ...heroSection,
            props: {
              ...(heroSection.props ?? {}),
              // Dedicated fallback used by FixedDefaultHomepage when there are
              // no published button pages to preview.
              masterBackgroundImageUrl: masterBg,
            },
          };
          content.sections = sections;
        }
      }
    } catch (error) {
      console.error(
        "[getLandingPage] Failed to resolve master background image",
        error,
      );
    }
  }

  if (stepSlugs && Array.isArray(stepSlugs) && stepSlugs.length > 0) {
    const steps: LandingPageContent[] = [];
    for (const stepSlug of stepSlugs) {
      const stepPage = await withPrismaRetry(() =>
        prisma.landingPage.findFirst({
        where: {
          slug: stepSlug,
          domainId: page.domainId,
          ...(includeArchived ? {} : { deletedAt: null }),
          ...(includeDraft ? {} : { status: "published" }),
        },
        include: { domain: true },
        }),
      );
      if (!stepPage?.domain) continue;
      let stepLayout: { layoutData: unknown } | null = null;
      try {
        const sl = await withPrismaRetry(() =>
          prisma.pageLayout.findUnique({
          where: { pageId: stepPage.id },
          }),
        );
        if (sl) stepLayout = { layoutData: sl.layoutData };
      } catch {
        // ignore
      }
      steps.push(pageToContent(stepPage, stepLayout));
    }
    content.multistepSteps = steps;
  }

  // Preserve requested URL in content so frontend and SEO use the correct slug.
  content.slug = requestedSlug;

  return content;
}

export async function getDomainRootPublishedSlug(
  hostname: string,
): Promise<string | null> {
  const domain = await withPrismaRetry(() =>
    prisma.domain.findFirst({
    where: { hostname, isActive: true },
    select: { id: true },
    }),
  );
  if (!domain) return null;

  const defaultSlug = await getDomainDefaultHomepageSlug(domain.id);
  if (defaultSlug) return defaultSlug;

  const preferredSlug = (process.env.DOMAIN_ROOT_DEFAULT_SLUG ?? "").trim();
  if (preferredSlug) {
    const preferredPage = await withPrismaRetry(() =>
      prisma.landingPage.findFirst({
      where: {
        domainId: domain.id,
        deletedAt: null,
        slug: preferredSlug,
        status: "published",
      },
      select: { slug: true },
      }),
    );
    if (preferredPage?.slug) return preferredPage.slug;
  }

  const latestPublishedPage = await withPrismaRetry(() =>
    prisma.landingPage.findFirst({
    where: {
      domainId: domain.id,
      deletedAt: null,
      status: "published",
    },
    orderBy: { updatedAt: "desc" },
    select: { slug: true },
    }),
  );
  return latestPublishedPage?.slug ?? null;
}

