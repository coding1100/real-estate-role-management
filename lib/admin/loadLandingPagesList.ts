import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PageListItem } from "@/components/admin/pageListTypes";
import { getFixedHomepagePageIds } from "@/lib/defaultHomepage";

export type PageOption = {
  id: string;
  slug: string;
  type: string;
  domainHostname: string;
  domainId: string;
};

export type LandingPagesListData = {
  tablePages: PageListItem[];
  pageOptions: PageOption[];
  domains: { id: string; hostname: string }[];
  templates: { id: string; type: string; name: string }[];
};

export async function loadLandingPagesList(): Promise<LandingPagesListData> {
  const fixedHomepageIds = await getFixedHomepagePageIds();
  const pages = await prisma.landingPage.findMany({
    include: { domain: true },
    orderBy: [{ domain: { hostname: "asc" } }, { slug: "asc" }],
  });

  let adminOrderById = new Map<string, number>();
  try {
    const orderRows = (await prisma.$queryRaw<
      { id: string; adminListOrder: number }[]
    >`
      SELECT "id", COALESCE("adminListOrder", 0) AS "adminListOrder"
      FROM "LandingPage"
    `) as Array<{ id: string; adminListOrder: number }>;
    adminOrderById = new Map(
      orderRows.map((r) => [r.id, Number(r.adminListOrder)]),
    );
  } catch (err) {
    console.error(
      "[loadLandingPagesList] Failed to load adminListOrder via SQL (column may be missing until migration is applied).",
      err,
    );
    adminOrderById = new Map();
  }

  pages.sort((a, b) => {
    const h = a.domain.hostname.localeCompare(b.domain.hostname);
    if (h !== 0) return h;
    const ao = adminOrderById.get(a.id) ?? 0;
    const bo = adminOrderById.get(b.id) ?? 0;
    if (ao !== bo) return ao - bo;
    return a.slug.localeCompare(b.slug);
  });

  const ids = pages.map((p) => p.id);
  let bookmarkedById = new Map<string, boolean>();
  let notesById = new Map<string, string | null>();
  if (ids.length > 0) {
    try {
      const rows = (await prisma.$queryRaw<
        { id: string; bookmarked: boolean }[]
      >`
        SELECT "id", "bookmarked"
        FROM "LandingPage"
        WHERE "id" IN (${Prisma.join(ids)})
      `) as Array<{ id: string; bookmarked: boolean }>;
      bookmarkedById = new Map(rows.map((r) => [r.id, !!r.bookmarked]));
    } catch (err) {
      console.error("[loadLandingPagesList] Failed to load bookmarks via SQL", err);
      bookmarkedById = new Map();
    }

    try {
      const noteRows = (await prisma.$queryRaw<
        { id: string; notes: string | null }[]
      >`
        SELECT "id", "notes"
        FROM "LandingPage"
        WHERE "id" IN (${Prisma.join(ids)})
      `) as Array<{ id: string; notes: string | null }>;
      notesById = new Map(noteRows.map((r) => [r.id, r.notes ?? null]));
    } catch (err) {
      console.error("[loadLandingPagesList] Failed to load notes via SQL", err);
      notesById = new Map();
    }
  }

  let domains: { id: string; hostname: string }[] = [];
  try {
    domains = await prisma.domain.findMany({
      where: { isActive: true },
      orderBy: { hostname: "asc" },
      select: { id: true, hostname: true },
    });
  } catch (err) {
    console.error(
      "[loadLandingPagesList] Failed to load domains. " +
        "This usually means the Domain table has not been created " +
        "in the current database schema.",
      err,
    );
    domains = [];
  }

  let templates: { id: string; type: string; name: string }[] = [];
  try {
    templates = await prisma.masterTemplate.findMany({
      orderBy: { type: "asc" },
      select: { id: true, type: true, name: true },
    });
  } catch (err) {
    console.error(
      "[loadLandingPagesList] Failed to load masterTemplate rows. " +
        "This usually means the MasterTemplate table has not been created " +
        "in the current database schema.",
      err,
    );
    templates = [];
  }

  const pageOptions: PageOption[] = pages
    .filter((p) => p.deletedAt == null)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      type: p.type,
      domainHostname: p.domain.hostname,
      domainId: p.domainId,
    }));

  const tablePages: PageListItem[] = pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    type: p.type,
    status: p.status,
    updatedAt: p.updatedAt.toISOString(),
    headline: p.headline ?? null,
    title: ((p as { title?: string | null }).title as string | null) ?? null,
    canonicalUrl:
      ((p as { canonicalUrl?: string | null }).canonicalUrl as string | null) ?? null,
    domainHostname: p.domain.hostname,
    domainId: p.domainId,
    multistepStepSlugs:
      ((p as { multistepStepSlugs?: string[] | null }).multistepStepSlugs as
        | string[]
        | null) ?? null,
    notes: notesById.has(p.id)
      ? (notesById.get(p.id) ?? null)
      : (((p as { notes?: string | null }).notes as string | null) ?? null),
    thumbnailImageUrl:
      (p as { heroImageUrl?: string | null; ogImageUrl?: string | null })
        .heroImageUrl ??
      (p as { heroImageUrl?: string | null; ogImageUrl?: string | null })
        .ogImageUrl ??
      null,
    bookmarked: bookmarkedById.get(p.id) ?? false,
    adminListOrder: adminOrderById.get(p.id) ?? 0,
    isFixedDefaultHomepage: fixedHomepageIds.has(p.id),
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
  }));

  return { tablePages, pageOptions, domains, templates };
}
