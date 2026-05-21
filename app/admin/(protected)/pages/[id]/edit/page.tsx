import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageEditor } from "@/components/admin/PageEditor";
import {
  DEFAULT_THEME,
  getAdminUiSettings,
  getEnabledEditorFonts,
} from "@/lib/uiSettings";
import { isFixedDefaultHomepagePage } from "@/lib/defaultHomepage";
import type { CtaForwardingRule } from "@/lib/types/ctaForwarding";
import { safePrismaRead } from "@/lib/prismaRetry";

type EditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPage({ params }: EditPageProps) {
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
  function readPageToastThemeOverride(rawSections: unknown): Record<string, unknown> | null {
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
    return raw as Record<string, unknown>;
  }

  const { id } = await params;

  let page;
  try {
    page = await prisma.landingPage.findUnique({
      where: { id, deletedAt: null },
      include: { domain: true },
    });
  } catch (err) {
    console.error("[EditPage] Failed to load landingPage", err);
    page = null;
  }

  if (!page || !page.domain) {
    notFound();
  }

  const domain = page.domain;
  const fixedDefaultHomepage = await safePrismaRead(
    "edit-page:isFixedDefaultHomepagePage",
    () => isFixedDefaultHomepagePage(page.id),
    false,
  );
  const allPages = await safePrismaRead(
    "edit-page:landingPage.findMany",
    () =>
      prisma.landingPage.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          slug: true,
          title: true,
          headline: true,
          status: true,
          domain: { select: { hostname: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
    [],
  );

  let pageLayout = null;
  try {
    pageLayout = await prisma.pageLayout.findUnique({
      where: { pageId: id },
    });
  } catch {
    // PageLayout table may not exist; run: npx prisma migrate deploy
    // or execute prisma/sql/page_layout.sql
  }

  const sections = (page.sections as any) ?? [];
  const heroForStepNotify = Array.isArray(sections)
    ? sections.find((s) => s && s.kind === "hero")
    : null;
  const multistepNotifyEachStep = Boolean(
    (heroForStepNotify as any)?.props?.multistepNotifyEachStep ??
      (page as { multistepNotifyEachStep?: boolean }).multistepNotifyEachStep,
  );

  // Derive per-page social overrides from hero section props, if present
  let socialOverrides: any = null;
  if (Array.isArray(sections)) {
    const hero = sections.find((s) => s && s.kind === "hero");
    if (hero && (hero as any).props && (hero as any).props.socialOverrides) {
      socialOverrides = (hero as any).props.socialOverrides;
    }
  }

  const pageContent = {
    dbId: page.id,
    domainId: page.domainId,
    domainPages: allPages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title ?? p.headline ?? p.slug,
      status: p.status,
      hostname: p.domain?.hostname ?? "",
    })),
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    multistepStepSlugs: (page as any).multistepStepSlugs ?? null,
    multistepNotifyEachStep,
    isFixedDefaultHomepage: fixedDefaultHomepage,
    type: page.type as "buyer" | "seller",
    headline: page.headline,
    subheadline: page.subheadline,
    heroImageUrl: page.heroImageUrl,
    ctaText: page.ctaText,
    successMessage: page.successMessage,
    footerHtml: (page as any).footerHtml ?? "",
    sections,
    formSchema: (page.formSchema as any) ?? null,
    socialOverrides,
    pageLayout: pageLayout ? {
      id: pageLayout.id,
      layoutData: pageLayout.layoutData,
    } : null,
    domain: {
      hostname: domain.hostname,
      displayName: domain.displayName,
      logoUrl: domain.logoUrl,
      primaryColor: domain.primaryColor,
      accentColor: domain.accentColor,
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
  };
  const initialCtaForwardingRules = readPageCtaForwardingRules(sections);
  const initialToastThemeOverride = readPageToastThemeOverride(sections);

  const { editorFonts } = await safePrismaRead(
    "edit-page:getAdminUiSettings",
    () => getAdminUiSettings(),
    {
      settings: {} as any,
      theme: DEFAULT_THEME,
      editorFonts: [] as any[],
    },
  );

  return (
    <PageEditor
      initialPage={pageContent}
      editorFonts={getEnabledEditorFonts(editorFonts)}
      initialCtaForwardingRules={initialCtaForwardingRules}
      initialToastThemeOverride={initialToastThemeOverride}
    />
  );
}

