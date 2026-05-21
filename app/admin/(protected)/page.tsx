import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { buildCustomerSiteUrl } from "@/lib/customerSiteUrl";

export default async function AdminDashboardPage() {
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
  const formatRelativeTime = (value: Date): string => {
    const now = Date.now();
    const diffMs = Math.max(0, now - value.getTime());
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diffMs < minuteMs) return "just now";
    if (diffMs < hourMs) {
      const minutes = Math.floor(diffMs / minuteMs);
      return `${minutes}m ago`;
    }
    if (diffMs < dayMs) {
      const hours = Math.floor(diffMs / hourMs);
      return `${hours}h ago`;
    }
    const days = Math.floor(diffMs / dayMs);
    return `${days}d ago`;
  };
  const [domainsCount, pagesCount, domains] = await Promise.all([
    prisma.domain.count().catch(() => 0),
    prisma.landingPage.count().catch(() => 0),
    prisma.domain
      .findMany({
        where: { isActive: true },
        orderBy: { hostname: "asc" },
        select: {
          id: true,
          hostname: true,
          displayName: true,
          defaultHomepagePageId: true,
          defaultHomepagePage: {
            select: {
              id: true,
              slug: true,
              title: true,
              headline: true,
              status: true,
              canonicalUrl: true,
              deletedAt: true,
              updatedAt: true,
            },
          },
        },
      })
      .catch(() => []),
  ]);

  const [domainPageStatuses, latestDomainEdits] = await Promise.all([
    prisma.landingPage
      .findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          domainId: true,
          status: true,
        },
      })
      .catch(() => []),
    prisma.landingPage
      .groupBy({
        by: ["domainId"],
        where: {
          deletedAt: null,
        },
        _max: {
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  const defaultHomepageIdByDomain = new Map<string, string>();
  for (const domain of domains) {
    if (domain.defaultHomepagePageId) {
      defaultHomepageIdByDomain.set(domain.id, domain.defaultHomepagePageId);
    }
  }
  const pageCountsByDomain = new Map<string, number>();
  for (const row of domainPageStatuses) {
    const defaultPageId = defaultHomepageIdByDomain.get(row.domainId);
    if (defaultPageId && row.id === defaultPageId) continue;
    const current = pageCountsByDomain.get(row.domainId) ?? 0;
    pageCountsByDomain.set(row.domainId, current + 1);
  }
  const latestEditByDomain = new Map<string, Date>();
  for (const row of latestDomainEdits) {
    if (row._max.updatedAt) {
      latestEditByDomain.set(row.domainId, row._max.updatedAt);
    }
  }

  const defaultHomeRows = domains.map((domain) => {
    const page = domain.defaultHomepagePage;
    const label = (page?.title ?? page?.headline ?? page?.slug ?? "").trim();
    const path = page ? resolveDisplayPath(page.slug, page.canonicalUrl) : null;
    const missingOrArchived = !!(page && page.deletedAt);
    const configured = !!(domain.defaultHomepagePageId && page && !missingOrArchived);
    const pagesCount = pageCountsByDomain.get(domain.id) ?? 0;
    const latestEditedAt = latestEditByDomain.get(domain.id) ?? null;
    return {
      domainId: domain.id,
      hostname: domain.hostname,
      displayName: domain.displayName?.trim() || domain.hostname,
      configured,
      path,
      pageId: page?.id ?? null,
      pageLabel: label || null,
      pageStatus: page?.status ?? null,
      missingOrArchived,
      pagesCount,
      latestEditedAt,
    };
  });

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
        Dashboard
      </h1>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Domains card */}
        <div className="relative overflow-hidden !rounded-md bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-[1px] shadow-sm">
          <div className="relative h-full !rounded-md bg-zinc-950/95 px-4 py-4 text-zinc-50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium uppercase tracking-[0.18em]">
                  Domains
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {domainsCount}
                </p>
              </div>
              <div className="rounded-full bg-zinc-800 px-3 py-1 text-[16px] font-medium text-zinc-200">
                Routing
              </div>
            </div>
            <p className="mt-3 text-[14px] text-zinc-300">
              Manage branded hostnames, logos, and tracking IDs.
            </p>
          </div>
        </div>

        {/* Landing pages card */}
        <div className="relative overflow-hidden !rounded-md bg-white p-4 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Landing pages
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">
                {pagesCount}
              </p>
            </div>
            <div className="rounded-full bg-zinc-900 px-3 py-1 text-[16px] font-medium text-zinc-50">
              Funnels
            </div>
          </div>
          <p className="mt-3 text-[14px] text-zinc-500">
            High-intent funnels across all domains.
          </p>
        </div>
        
      </div>

      {/* Default home pages by domain */}
      <div className="space-y-4 pb-[15px]">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
          Default Home Pages by Domain
        </h2>
        <p className="text-md text-zinc-500">
          Review each domain's configured default home page and quickly open it for edits.
        </p>
        {defaultHomeRows.length === 0 ? (
          <div className="!rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">
            No active domains found.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {defaultHomeRows.map((row) => (
              <div
                key={row.domainId}
                className="relative !rounded-md border border-zinc-200 bg-white p-4 shadow-sm"
              >
                {row.configured && row.path ? (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    <Link
                      href={`/admin/pages/${row.pageId}/edit`}
                      aria-label="Edit page"
                      title="Edit page"
                      className="inline-flex h-7 w-7 items-center justify-center !rounded-md border border-zinc-300 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 20h9" />
                        <path d="m16.5 3.5 4 4L7 21l-4 1 1-4L16.5 3.5Z" />
                      </svg>
                    </Link>
                    <a
                      href={buildCustomerSiteUrl(row.hostname, row.path)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View live page"
                      title="View live page"
                      className="inline-flex h-7 w-7 items-center justify-center !rounded-md bg-zinc-900 text-white transition hover:bg-zinc-800"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 4h6v6" />
                        <path d="M10 14 20 4" />
                        <path d="M20 14v6H4V4h6" />
                      </svg>
                    </a>
                  </div>
                ) : null}
                <div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{row.displayName}
                    <span
                      className={`m-[10px] inline-block relative -top-[3px] rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        row.configured
                          ? "bg-emerald-100 text-emerald-700"
                          : row.missingOrArchived
                            ? "bg-amber-100 text-amber-700"
                            : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {row.configured
                        ? "Configured"
                        : row.missingOrArchived
                          ? "Missing page"
                          : "Not configured"}
                    </span>
                    </p>
                    <p className="text-xs text-zinc-500">{row.hostname}</p>
                    {row.latestEditedAt ? (
                      <p className="mt-0.5 !text-[13px] text-zinc-400 flex flex-wrap items-center gap-2">
                        <span>
                          Last edited{" "}
                          {new Date(row.latestEditedAt).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          ({formatRelativeTime(new Date(row.latestEditedAt))})
                        </span>
                        <span className="rounded-full text-[13px] bg-zinc-100 px-2.5 py-0.5 text-zinc-600">
                          Pages: {row.pagesCount}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
                {row.configured && row.path ? (
                  <div className="mt-3 space-y-2">
                    <p className="line-clamp-1 text-sm font-medium text-zinc-800">
                      {row.pageLabel}
                    </p>
                    <p className="line-clamp-1 rounded bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
                      {row.path}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">
                    Configure a default home page from <span className="font-medium">Domains</span>.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

