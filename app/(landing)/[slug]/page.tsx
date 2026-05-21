import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getLandingPage,
  asUnpublishedLandingPageError,
} from "@/lib/pages";
import { prisma } from "@/lib/prisma";
import { BuyerTemplate } from "@/components/templates/BuyerTemplate";
import { SellerTemplate } from "@/components/templates/SellerTemplate";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { getAdminUiSettings } from "@/lib/uiSettings";
import type { ToastTheme } from "@/lib/uiSettings";
import { ToastProvider } from "@/components/ui/use-toast";
import { UnpublishedPageNotice } from "@/components/landing/UnpublishedPageNotice";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import {
  getRequestHostnameFromHeaders,
  isPreviewHostname,
  isPlatformHostname,
  resolveTenantHostname,
  normalizeHostname,
  shouldIncludeDraftForLandingRequest,
} from "@/lib/hostnames";

// Force dynamic rendering and no caching
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteParams = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[]>> | Record<string, string | string[]>;
};

function getQueryStringParam(
  query: Record<string, string | string[]> | undefined,
  key: string,
): string | null {
  if (!query) return null;
  const raw = query[key];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function getPreviewHostnameOverride(
  query: Record<string, string | string[]>,
): string | null {
  const raw =
    getQueryStringParam(query, "domain") ||
    getQueryStringParam(query, "hostname") ||
    getQueryStringParam(query, "host");
  if (!raw) return null;
  const normalized = normalizeHostname(raw);
  return normalized.length > 0 ? normalized : null;
}

async function getHostContextFromHeaders() {
  const rawHostname = await getRequestHostnameFromHeaders();
  return {
    rawHostname,
    hostname: resolveTenantHostname(rawHostname),
    isPreviewHost: isPreviewHostname(rawHostname),
    isPlatformHost: isPlatformHostname(rawHostname),
  };
}

function readPageCtaForwardingRules(rawSections: unknown): CtaForwardingRule[] {
  if (!Array.isArray(rawSections)) return [];
  const hero = rawSections.find(
    (section) =>
      section &&
      typeof section === "object" &&
      (section as { kind?: unknown }).kind === "hero",
  ) as { props?: unknown } | undefined;
  if (!hero || !hero.props || typeof hero.props !== "object") return [];
  const rules = (hero.props as { ctaForwardingRules?: unknown }).ctaForwardingRules;
  return Array.isArray(rules) ? (rules as CtaForwardingRule[]) : [];
}

function readPageToastThemeOverride(
  rawSections: unknown,
): Partial<ToastTheme> | null {
  if (!Array.isArray(rawSections)) return null;
  const hero = rawSections.find(
    (section) =>
      section &&
      typeof section === "object" &&
      (section as { kind?: unknown }).kind === "hero",
  ) as { props?: unknown } | undefined;
  if (!hero || !hero.props || typeof hero.props !== "object") return null;
  const raw = (hero.props as { toastThemeOverride?: unknown }).toastThemeOverride;
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const normalized: Partial<ToastTheme> = {};
  if (
    input.position === "top-right" ||
    input.position === "top-left" ||
    input.position === "top-center" ||
    input.position === "bottom-right" ||
    input.position === "bottom-left" ||
    input.position === "bottom-center"
  ) {
    normalized.position = input.position;
  }
  if (typeof input.durationMs === "number" && Number.isFinite(input.durationMs)) {
    normalized.durationMs = Math.min(30000, Math.max(1000, Math.floor(input.durationMs)));
  }
  if (typeof input.iconSize === "number" && Number.isFinite(input.iconSize)) {
    normalized.iconSize = Math.min(40, Math.max(14, Math.floor(input.iconSize)));
  }
  const keys: Array<keyof ToastTheme> = [
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
  for (const key of keys) {
    const v = input[key];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (!trimmed) continue;
      (normalized as Record<string, unknown>)[key] = trimmed;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function canonicalPathFromUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw)
        : new URL(raw, "https://placeholder.local");
    const path = (parsed.pathname || "").trim();
    if (!path || path === "/") return null;
    return `/${path.replace(/^\/+|\/+$/g, "")}`;
  } catch {
    if (!raw.startsWith("/")) return null;
    const path = raw.split("?")[0]?.split("#")[0]?.trim() ?? "";
    if (!path || path === "/") return null;
    return `/${path.replace(/^\/+|\/+$/g, "")}`;
  }
}

async function readMultistepLastStepToastThemeOverride(input: {
  page: Awaited<ReturnType<typeof getLandingPage>>;
  effectiveHostname: string;
  includeDraft: boolean;
}): Promise<Partial<ToastTheme> | null> {
  const stepSlugs = Array.isArray(
    (input.page as { multistepStepSlugs?: unknown }).multistepStepSlugs,
  )
    ? ((input.page as { multistepStepSlugs?: unknown }).multistepStepSlugs as unknown[])
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim())
    : [];
  if (stepSlugs.length === 0) return null;

  const lastStepSlug = stepSlugs[stepSlugs.length - 1];
  if (!lastStepSlug) return null;

  try {
    // Use a direct DB lookup to avoid slug fallback behavior from generic page
    // resolver and make "last step override" deterministic on live.
    const lastStepPage = await prisma.landingPage.findFirst({
      where: {
        slug: lastStepSlug,
        ...(input.includeDraft ? {} : { status: "published" }),
        ...(input.includeDraft ? {} : { deletedAt: null }),
        domain: {
          hostname: input.effectiveHostname,
          isActive: true,
        },
      },
      select: {
        sections: true,
      },
    });
    if (!lastStepPage) {
      console.log("[toast] Multistep last-step page not found", {
        entrySlug: input.page.slug,
        lastStepSlug,
        hostname: input.effectiveHostname,
        includeDraft: input.includeDraft,
      });
      return null;
    }
    const override =
      readPageToastThemeOverride((lastStepPage as { sections?: unknown }).sections) ??
      null;
    console.log("[toast] Multistep last-step override resolution", {
      entrySlug: input.page.slug,
      lastStepSlug,
      hostname: input.effectiveHostname,
      includeDraft: input.includeDraft,
      overrideFound: !!override,
    });
    return override;
  } catch {
    console.log("[toast] Multistep last-step override lookup failed", {
      entrySlug: input.page.slug,
      lastStepSlug,
      hostname: input.effectiveHostname,
      includeDraft: input.includeDraft,
    });
    return null;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const query = (await (searchParams as any)) ?? {};
  const { hostname, isPreviewHost, isPlatformHost, rawHostname } =
    await getHostContextFromHeaders();
  const includeDraft = shouldIncludeDraftForLandingRequest(rawHostname, query);
  const hostnameOverride =
    (isPreviewHost || isPlatformHost) && query
      ? getPreviewHostnameOverride(query)
      : null;
  const effectiveHostname = hostnameOverride || hostname;
  let page;
  try {
    page = await getLandingPage(effectiveHostname, slug, {
      allowFallbackToAnyDomain: isPreviewHost,
      includeDraft,
      includeArchived: includeDraft,
    });
  } catch (e) {
    const unpublished = asUnpublishedLandingPageError(e);
    if (unpublished) {
      return {
        title: `Coming soon | ${unpublished.siteName}`,
        robots: { index: false, follow: false },
      };
    }
    throw e;
  }

  const title = page.seo.title || page.headline;
  const description = page.seo.description || page.subheadline || undefined;
  const canonical =
    page.seo.canonicalUrl ||
    `https://${page.domain.hostname}/${page.slug}`;

  const meta: Metadata = {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: (page.seo.ogType as
        | "website"
        | "article"
        | "book"
        | "profile"
        | "music.song"
        | "music.album"
        | "music.playlist"
        | "music.radio_station"
        | "video.movie"
        | "video.episode"
        | "video.tv_show"
        | "video.other") || "website",
      siteName: page.domain.displayName,
      images: page.seo.ogImageUrl ? [page.seo.ogImageUrl] : [],
    },
    twitter: {
      card: (page.seo.twitterCard as
        | "summary_large_image"
        | "summary"
        | "player"
        | "app") || "summary_large_image",
      title,
      description,
      images: page.seo.ogImageUrl ? [page.seo.ogImageUrl] : [],
    },
    icons: {
      icon: [{ url: page.domain.faviconUrl || "/engel-volkers-logo.svg" }],
      shortcut: [{ url: page.domain.faviconUrl || "/engel-volkers-logo.svg" }],
      apple: [{ url: page.domain.faviconUrl || "/engel-volkers-logo.svg" }],
    },
    robots: page.seo.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };

  return meta;
}

export default async function LandingPage({ params, searchParams }: RouteParams) {
  const { slug } = await params;
  const query = (await (searchParams as any)) ?? {};
  const utm = {
    source: Array.isArray(query.utm_source) ? query.utm_source[0] : query.utm_source,
    medium: Array.isArray(query.utm_medium) ? query.utm_medium[0] : query.utm_medium,
    campaign: Array.isArray(query.utm_campaign)
      ? query.utm_campaign[0]
      : query.utm_campaign,
  };
  const { hostname, isPreviewHost, isPlatformHost, rawHostname } =
    await getHostContextFromHeaders();
  const hostnameOverride =
    (isPreviewHost || isPlatformHost) && query
      ? getPreviewHostnameOverride(query)
      : null;
  const effectiveHostname = hostnameOverride || hostname;
  const includeDraft = shouldIncludeDraftForLandingRequest(rawHostname, query);
  let page;
  try {
    page = await getLandingPage(effectiveHostname, slug, {
      allowFallbackToAnyDomain: isPreviewHost,
      includeDraft,
      includeArchived: includeDraft,
    });
  } catch (e) {
    const unpublished = asUnpublishedLandingPageError(e);
    if (unpublished) {
      return (
        <UnpublishedPageNotice
          siteName={unpublished.siteName}
          hostname={unpublished.hostname}
          slug={unpublished.slug}
        />
      );
    }
    throw e;
  }
  if (!includeDraft) {
    const canonicalPath = canonicalPathFromUrl(page.seo?.canonicalUrl ?? null);
    const requestedPath = `/${String(slug ?? "").trim().replace(/^\/+|\/+$/g, "")}`;
    if (
      canonicalPath &&
      canonicalPath.toLowerCase() !== requestedPath.toLowerCase()
    ) {
      redirect(canonicalPath);
    }
  }
  const { settings, theme } = await getAdminUiSettings();
  const pageCtaForwardingRules = readPageCtaForwardingRules(
    (page as { sections?: unknown }).sections,
  );
  const currentPageToastThemeOverride =
    ((page as { toastThemeOverride?: Partial<ToastTheme> | null }).toastThemeOverride ??
      readPageToastThemeOverride((page as { sections?: unknown }).sections)) ??
    null;
  const lastStepToastThemeOverride = await readMultistepLastStepToastThemeOverride({
    page,
    effectiveHostname,
    includeDraft,
  });
  const pageToastThemeOverride = lastStepToastThemeOverride ?? currentPageToastThemeOverride;
  console.log("[toast] Applied toast theme source", {
    pageSlug: page.slug,
    hasLastStepOverride: !!lastStepToastThemeOverride,
    hasCurrentPageOverride: !!currentPageToastThemeOverride,
    usingSource: lastStepToastThemeOverride
      ? "multistep-last-step-local"
      : currentPageToastThemeOverride
        ? "current-page-local"
        : "global-frontend",
  });
  const frontendBaseToastTheme: ToastTheme = {
    ...theme,
    position: theme.frontendPosition ?? theme.position,
    durationMs: theme.frontendDurationMs ?? theme.durationMs,
  };
  const resolvedToastTheme: ToastTheme = {
    ...frontendBaseToastTheme,
    ...(pageToastThemeOverride ?? {}),
  };
  const resolvedCtaForwardingRules =
    pageCtaForwardingRules.length > 0
      ? pageCtaForwardingRules
      : (settings.ctaForwardingRules ?? []);

  const content =
    page.type === "seller" ? (
      <SellerTemplate
        page={page}
        utm={utm}
        ctaForwardingRules={resolvedCtaForwardingRules}
      />
    ) : (
      <BuyerTemplate
        page={page}
        utm={utm}
        ctaForwardingRules={resolvedCtaForwardingRules}
      />
    );

  return (
    <ToastProvider theme={resolvedToastTheme}>
      <GoogleAnalytics measurementId={page.domain.ga4Id} />
      <MetaPixel pixelId={page.domain.metaPixelId} />
      {content}
    </ToastProvider>
  );
}

