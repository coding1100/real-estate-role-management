import type { BlockConfig, LandingPageContent } from "@/lib/types/page";

export function getDefaultBlocksForPage(
  _page: LandingPageContent,
): BlockConfig[] {
  return [
    { id: "block-header", kind: "header", props: {} },
    { id: "block-hero-headline", kind: "heroHeadline", props: {} },
    { id: "block-hero-subheadline", kind: "heroSubheadline", props: {} },
    { id: "block-hero-left", kind: "heroLeftRichText", props: {} },
    { id: "block-hero-form", kind: "heroForm", props: {} },
  ];
}

