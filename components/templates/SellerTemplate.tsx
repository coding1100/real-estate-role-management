import type {
  BlockConfig,
  HeroElementsByColumn,
  LandingPageContent,
} from "@/lib/types/page";
import type { CSSProperties } from "react";
import { HeroSection } from "./sections/HeroSection";
import { MultistepHeroFlow } from "./MultistepHeroFlow";
import Image from "next/image";
import { getDefaultBlocksForPage } from "@/lib/blocks/defaultBlocks";
import { HomeValueExperience } from "./sections/HomeValueExperience";
import { HomeValueMultistepFlow } from "./HomeValueMultistepFlow";
import { FixedDefaultHomepage } from "./sections/FixedDefaultHomepage";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";

interface SellerTemplateProps {
  page: LandingPageContent;
  ctaForwardingRules?: CtaForwardingRule[];
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

function BrandHeader({ page }: { page: LandingPageContent }) {
  return (
    <header className="border-b border-zinc-200 bg-white fixed top-0 right-0 left-0 z-[99]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-3 max-[768px]:px-3 max-[768px]:py-2 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {page.domain.logoUrl ? (
            <Image
              src={page.domain.logoUrl}
              alt={page.domain.displayName}
              width={180}
              height={62}
              loading="lazy"
              className="h-[60px] w-auto object-contain max-[768px]:max-h-10 max-[768px]:max-w-[120px]"
            />
          ) : (
            <span className="text-lg font-normal text-zinc-900" style={{ fontFamily: 'Source Sans 3' }}>
              {page.domain.displayName}
            </span>
          )}
        </div>
        <div className="flex items-center shrink-0">
          {page.domain.rightLogoUrl ? (
            <Image
              src={page.domain.rightLogoUrl}
              alt="Right logo"
              width={150}
              height={24}
              loading="lazy"
              className="max-h-[55px] w-auto object-contain max-[768px]:max-h-8 max-[768px]:max-w-[100px]"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SellerTemplate({
  page,
  utm,
  ctaForwardingRules,
}: SellerTemplateProps) {
  if (page.isFixedDefaultHomepage) {
    return <FixedDefaultHomepage page={page} />;
  }

  const heroFormSchema = page.formSchema ?? {
    fields: [],
  };

  const heroSections = Array.isArray(page.sections) ? page.sections : [];
  const heroSection = heroSections.find((s) => s.kind === "hero");
  const heroConfig = (heroSection?.props as Record<string, unknown>) || {};
  const heroElements = heroConfig.heroElements as
    | HeroElementsByColumn
    | undefined;

  const blocks: BlockConfig[] =
    page.blocks && page.blocks.length > 0
      ? page.blocks
      : getDefaultBlocksForPage(page);

  const hasBlock = (kind: BlockConfig["kind"]) =>
    blocks.some((b) => b.kind === kind && b.hidden !== true);

  const layoutData = page.pageLayout?.layoutData as
    | { i: string; hidden?: boolean }[]
    | undefined;
  const hasLayoutHeader = layoutData?.some(
    (l) => l.i === "header-bar" && l.hidden !== true,
  );
  const hasLayoutFooter = layoutData?.some(
    (l) => l.i === "footer-bar" && l.hidden !== true,
  );

  // Any page that uses the home-value specific hero fields (lower strip / map footer),
  // except the dedicated /home-value-qualify step, should get the specialized layout.
  const isHomeValuePage =
    page.slug !== "home-value-qualify" &&
    (!!(heroConfig as any).heroLowerStripHtml ||
      !!(heroConfig as any).formFooterText ||
      (heroConfig as any).formStyle === "property-finding");

  const utmHiddenFields =
    utm && (utm.source || utm.medium || utm.campaign)
      ? {
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
        }
      : undefined;

  const rawFooterHtml = page.footerHtml ?? "";
  const footerTextContent = rawFooterHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width and BOM
    .replace(/\s+/g, " ")
    .trim();

  const showFooter = footerTextContent.length > 0;
  const footerBgColor =
    ((heroConfig as any).footerBgColor as string | undefined) || "#f7f3f0";

  // Blockquote style should reflect the hero configuration used for the
  // currently visible content. For multistep pages we follow the first step's
  // hero config so the entry page matches step 1 styling.
  const firstStepHeroConfig =
    page.multistepSteps && page.multistepSteps.length > 0
      ? ((page.multistepSteps[0].sections || []) as any[]).find(
          (s) => s.kind === "hero",
        )?.props
      : null;

  const blockquoteStyle = (firstStepHeroConfig || heroConfig)?.blockquoteStyle as
    | { bg?: string; border?: string }
    | undefined;
  const pageStyleVars =
    blockquoteStyle && (blockquoteStyle.bg || blockquoteStyle.border)
      ? ({
          ["--blockquote-bg" as any]: blockquoteStyle.bg,
          ["--blockquote-border" as any]: blockquoteStyle.border,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className="min-h-screen bg-zinc-50 custom flex flex-col"
      style={pageStyleVars}
    >
      {hasLayoutHeader ? (
        <div className="fixed top-0 left-0 right-0 z-50 max-h-[100px] border-b border-zinc-200 bg-white overflow-hidden">
          <BrandHeader page={page} />
        </div>
      ) : (
        <BrandHeader page={page} />
      )}
      <main className={hasLayoutHeader ? "pt-[80px] flex-1" : "flex-1"}>
        {isHomeValuePage && page.multistepSteps && page.multistepSteps.length > 0 ? (
          <HomeValueMultistepFlow
            mainPage={page}
            steps={page.multistepSteps}
            layoutData={layoutData as any}
            utmHiddenFields={utmHiddenFields}
            ctaForwardingRules={ctaForwardingRules}
          />
        ) : isHomeValuePage ? (
          <HomeValueExperience
            page={page}
            layout={heroConfig as any}
            formSchema={heroFormSchema as any}
            utmHiddenFields={utmHiddenFields}
            ctaForwardingRules={ctaForwardingRules}
          />
        ) : page.multistepSteps && page.multistepSteps.length > 0 ? (
          <MultistepHeroFlow
            mainPage={page}
            steps={page.multistepSteps}
            layoutData={layoutData as any}
            utmHiddenFields={utmHiddenFields}
            ctaForwardingRules={ctaForwardingRules}
          />
        ) : (
          <HeroSection
            page={page}
            formSchema={heroFormSchema as any}
            layout={heroConfig as any}
            layoutData={layoutData as any}
            heroElements={heroElements}
            utmHiddenFields={utmHiddenFields}
            ctaForwardingRules={ctaForwardingRules}
            visibleBlocks={{
              showHeadline: hasBlock("heroHeadline"),
              showSubheadline: hasBlock("heroSubheadline"),
              showLeft: hasBlock("heroLeftRichText"),
              showForm: hasBlock("heroForm"),
            }}
          />
        )}
      </main>
      {showFooter && (
        <footer
          className="mt-10 relative z-50"
          style={{
            backgroundColor: footerBgColor,
          }}
        >
          <div className="mx-auto max-w-6xl px-3 py-3 md:px-3 relative">
            <div
              className="prose prose-sm max-w-none text-zinc-700"
              dangerouslySetInnerHTML={{
                __html: wrapLegalSignsHtml(page.footerHtml as string),
              }}
            />
          </div>
        </footer>
      )}
      
    </div>
  );
}

