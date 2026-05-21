import { prisma } from "@/lib/prisma";
import { safePrismaRead } from "@/lib/prismaRetry";

interface LeadRow {
  id: string;
  createdAt: Date;
  type: string;
  status: string;
  domain: { hostname: string };
  page: { slug: string };
}

export default async function LeadsPage() {
  const leads = (await safePrismaRead(
    "leads:lead.findMany",
    () =>
      prisma.lead.findMany({
        include: { domain: true, page: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    [],
  )) as LeadRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
        Leads
      </h1>
      <div className="max-[768px]:overflow-x-auto max-[768px]:-mx-2">
        <table className="min-w-full overflow-hidden rounded-lg bg-white text-md shadow-sm max-[768px]:min-w-[600px]">
        <thead className="bg-zinc-50 text-[16px] uppercase tracking-[0.15em] text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Domain</th>
            <th className="px-3 py-2 text-left">Page</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead: LeadRow) => (
            <tr key={lead.id} className="border-t border-zinc-100">
              <td className="px-33 py-2 text-zinc-700">
                {lead.createdAt.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-zinc-700">
                {lead.domain.hostname}
              </td>
              <td className="px-3 py-3 text-zinc-700">
                {lead.page.slug}
              </td>
              <td className="px-3 py-3 text-zinc-700">
                {lead.type}
              </td>
              <td className="px-3 py-3 text-zinc-700">
                {lead.status}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-4 text-center text-zinc-500"
              >
                No leads yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

