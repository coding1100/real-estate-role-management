import type { FormSchema } from "./form";

export type LandingPageType = "buyer" | "seller";

export interface SectionConfig {
  id: string;
  kind: "hero";
  props: Record<string, unknown>;
}

export type BlockKind =
  | "header"
  | "heroLayout"
  | "heroHeadline"
  | "heroSubheadline"
  | "heroLeftRichText"
  | "heroForm"
  | "heroTrustRow"
  | "heroBadgeStrip";

export type HeroElementKind =
  | "heroHeadline"
  | "heroSubheadline"
  | "heroLeftRichText"
  | "heroForm"
  | "heroTrustRow"
  | "heroBadgeStrip";

export interface HeroElementConfig {
  id: string;
  kind: HeroElementKind;
  column: "left" | "right";
  hidden?: boolean;
}

export interface HeroElementsByColumn {
  left: HeroElementConfig[];
  right: HeroElementConfig[];
}

export interface BlockConfig {
  id: string;
  kind: BlockKind;
  props: Record<string, unknown>;
  hidden?: boolean;
}

export interface LandingPageContent {
  id: string;
  slug: string;
  title?: string | null;
  domain: {
    hostname: string;
    displayName: string;
    logoUrl?: string | null;
    rightLogoUrl?: string | null;
    primaryColor: string;
    accentColor: string;
    ga4Id?: string | null;
    metaPixelId?: string | null;
    recaptchaSiteKey?: string | null;
    faviconUrl?: string | null;
    linkedinUrl?: string | null;
    linkedinVisible?: boolean | null;
    googleUrl?: string | null;
    googleVisible?: boolean | null;
    facebookUrl?: string | null;
    facebookVisible?: boolean | null;
    instagramUrl?: string | null;
    instagramVisible?: boolean | null;
    zillowUrl?: string | null;
    zillowVisible?: boolean | null;
  };
  type: LandingPageType;
  headline: string;
  subheadline?: string | null;
  heroImageUrl?: string | null;
  ctaText: string;
  successMessage: string;
  footerHtml?: string | null;
  sections: SectionConfig[];
  blocks?: BlockConfig[];
  formSchema?: FormSchema | null;
  pageLayout?: any | null;
  /** When true, intermediate Continue on this page triggers per-step notify (see CTA tab). */
  multistepNotifyEachStep?: boolean;
  multistepSteps?: LandingPageContent[];
  isFixedDefaultHomepage?: boolean;
  defaultHomepageButtons?: {
    id: string;
    slug: string;
    title: string;
    heroImageUrl?: string | null;
    href?: string | null;
    target?: "_self" | "_blank";
    styleMode?: "light" | "dark";
    ctaBgColor?: string;
    ctaTextColor?: string;
    ctaActiveBgColor?: string;
    ctaActiveTextColor?: string;
    isFeatured?: boolean;
  }[];
  // Optional per-page social icon overrides; falls back to domain settings when undefined
  socialOverrides?: {
    linkedinUrl?: string | null;
    linkedinVisible?: boolean | null;
    googleUrl?: string | null;
    googleVisible?: boolean | null;
    facebookUrl?: string | null;
    facebookVisible?: boolean | null;
    instagramUrl?: string | null;
    instagramVisible?: boolean | null;
    zillowUrl?: string | null;
    zillowVisible?: boolean | null;
    youtubeUrl?: string | null;
    youtubeVisible?: boolean | null;
    tiktokUrl?: string | null;
    tiktokVisible?: boolean | null;
  } | null;
  toastThemeOverride?: {
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
  } | null;
  seo: {
    title?: string | null;
    description?: string | null;
    keywords?: string[] | null;
    ogImageUrl?: string | null;
    ogType?: string | null;
    twitterCard?: string | null;
    canonicalUrl?: string | null;
    noIndex?: boolean | null;
    schemaMarkup?: Record<string, unknown> | null;
    customHeadTags?: { name: string; content: string }[] | null;
  };
}

