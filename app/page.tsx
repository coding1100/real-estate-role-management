import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDomainDefaultHomepageSlug } from "@/lib/defaultHomepage";
import {
  getRequestHostnameFromHeaders,
  isPlatformHostname,
  isPreviewHostname,
  resolveTenantHostname,
} from "@/lib/hostnames";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function resolveTenantRootSlug(
  hostname: string,
  allowFallbackToAnyDomain: boolean,
): Promise<string | null> {
  const hostCandidates = hostname.startsWith("www.")
    ? [hostname, hostname.slice(4)]
    : [hostname, `www.${hostname}`];
  const domain = await prisma.domain.findFirst({
    where: {
      hostname: { in: hostCandidates },
      isActive: true,
    },
    select: { id: true },
  });

  if (domain) {
    const defaultHomepageSlug = await getDomainDefaultHomepageSlug(domain.id);
    if (defaultHomepageSlug) return defaultHomepageSlug;

    const preferredSlug = (process.env.DOMAIN_ROOT_DEFAULT_SLUG ?? "").trim();
    if (preferredSlug) {
      const preferredPage = await prisma.landingPage.findFirst({
        where: {
          domainId: domain.id,
          slug: preferredSlug,
          status: "published",
        },
        select: { slug: true },
      });
      if (preferredPage?.slug) return preferredPage.slug;
    }

    const latestPublishedPage = await prisma.landingPage.findFirst({
      where: {
        domainId: domain.id,
        status: "published",
      },
      orderBy: { updatedAt: "desc" },
      select: { slug: true },
    });
    return latestPublishedPage?.slug ?? null;
  }

  if (!allowFallbackToAnyDomain) return null;

  const fallbackPage = await prisma.landingPage.findFirst({
    where: {
      status: "published",
      domain: { isActive: true },
    },
    orderBy: { updatedAt: "desc" },
    select: { slug: true },
  });
  return fallbackPage?.slug ?? null;
}

export default async function Home() {
  const rawHostname = await getRequestHostnameFromHeaders();
  const hostname = resolveTenantHostname(rawHostname);

  // Resolve tenant root first. `NEXTAUTH_URL` is merged into platform hosts; if it
  // points at a customer domain by mistake, `isPlatformHostname` would still be true
  // for that host — but the Domain row and default homepage must win.
  const tenantRootSlug = await resolveTenantRootSlug(
    hostname,
    isPreviewHostname(rawHostname),
  );
  if (tenantRootSlug) {
    redirect(`/${tenantRootSlug}`);
  }

  // Main platform hostname: send "/" to the master seller template preview.
  if (isPlatformHostname(hostname)) {
    redirect("/master-seller");
  }

  notFound();
}
