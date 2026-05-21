import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { LandingPageContent, LandingPageType } from "@/lib/types/page";
import { BuyerTemplate } from "@/components/templates/BuyerTemplate";
import { SellerTemplate } from "@/components/templates/SellerTemplate";

type RouteParams = {
  params: Promise<{
    type: LandingPageType;
  }>;
};

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { type } = await params;
  const masterSlug = type === "buyer" ? "master-buyer" : "master-seller";

  const page = await prisma.landingPage.findFirst({
    where: {
      slug: masterSlug,
      status: "published",
      ...(type === "buyer"
        ? {
            domain: {
              hostname: "bendhomes.us",
              isActive: true,
            },
          }
        : {}),
    },
    select: {
      headline: true,
      slug: true,
    },
    orderBy:
      type === "buyer"
        ? [{ updatedAt: "desc" }]
        : [{ updatedAt: "desc" }],
  });

  if (!page) {
    return {
      title: "Template not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${page.headline ?? page.slug} (${type}) – Master template`,
    robots: { index: false, follow: false },
  };
}

export default async function MasterTemplatePreview({
  params,
}: RouteParams) {
  const { type } = await params;
  const masterSlug = type === "buyer" ? "master-buyer" : "master-seller";

  const page =
    (await prisma.landingPage.findFirst({
      where: {
        slug: masterSlug,
        status: "published",
        ...(type === "buyer"
          ? {
              domain: {
                hostname: "bendhomes.us",
                isActive: true,
              },
            }
          : {}),
      },
      include: {
        domain: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    })) ??
    (type === "buyer"
      ? await prisma.landingPage.findFirst({
          where: {
            slug: masterSlug,
            status: "published",
          },
          include: {
            domain: true,
          },
          orderBy: [{ updatedAt: "desc" }],
        })
      : null);

  if (!page || !page.domain) {
    notFound();
  }

  let pageLayout: { layoutData: unknown } | null = null;
  try {
    const layout = await prisma.pageLayout.findUnique({
      where: { pageId: page.id },
    });
    if (layout) {
      pageLayout = { layoutData: layout.layoutData };
    }
  } catch {
    pageLayout = null;
  }

  const rawSections = page.sections as any;
  const sections: any[] = Array.isArray(rawSections) ? rawSections : [];

  const pageContent: LandingPageContent = {
    id: page.id,
    slug: page.slug,
    type: page.type as LandingPageContent["type"],
    headline: page.headline,
    subheadline: page.subheadline,
    heroImageUrl: page.heroImageUrl,
    ctaText: page.ctaText,
    successMessage: page.successMessage,
    sections,
    formSchema: (page.formSchema as any) ?? null,
    pageLayout,
    domain: {
      hostname: page.domain.hostname,
      displayName: page.domain.displayName,
      logoUrl: page.domain.logoUrl,
      rightLogoUrl: page.domain.agentPhoto,
      primaryColor: page.domain.primaryColor,
      accentColor: page.domain.accentColor,
      ga4Id: page.domain.ga4Id,
      metaPixelId: page.domain.metaPixelId,
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
  };

  const content =
    type === "seller" ? (
      <SellerTemplate page={pageContent} />
    ) : (
      <BuyerTemplate page={pageContent} />
    );

  return content;
}

