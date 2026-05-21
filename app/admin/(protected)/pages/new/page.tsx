import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { safePrismaRead } from "@/lib/prismaRetry";

type NewPageProps = {
  searchParams: Promise<{
    template?: string;
  }>;
};

export default async function NewPagePage({ searchParams }: NewPageProps) {
  const params = await searchParams;

  const domains = await safePrismaRead(
    "new-page:domain.findMany",
    () =>
      prisma.domain.findMany({
        where: { isActive: true },
        orderBy: { hostname: "asc" },
      }),
    [],
  );
  const templates = await safePrismaRead(
    "new-page:masterTemplate.findMany",
    () => prisma.masterTemplate.findMany(),
    [],
  );

  type Domain = (typeof domains)[number];
  type MasterTemplate = (typeof templates)[number];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
        New page
      </h1>
      <form
        className="space-y-3 rounded-sm bg-white p-4 shadow-sm text-md"
        action="/api/admin/pages"
        method="post"
      >
        <div>
          <label className="mb-1 block text-md font-medium text-zinc-700">
            Domain
          </label>
          <select
            name="domainId"
            className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            {domains.map((d: Domain) => (
              <option key={d.id} value={d.id}>
                {d.hostname}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-md font-medium text-zinc-700">
              Template
            </label>
            <select
              name="template"
              defaultValue={params.template ?? "buyer"}
              className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              {templates.map((t: MasterTemplate) => (
                <option key={t.id} value={t.type}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-md font-medium text-zinc-700">
              Slug
            </label>
            <input
              name="slug"
              className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="free-homes-list"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-md font-medium text-zinc-700">
            Headline
          </label>
          <input
            name="headline"
            className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Free List of Homes in Bend"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-md font-medium text-zinc-700">
            Subheadline
          </label>
          <textarea
            name="subheadline"
            className="block w-full !rounded-md border border-zinc-300 px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <button
          type="submit"
          className="mt-2 inline-flex items-center !rounded-md bg-zinc-900 px-3 py-1.5 text-md font-medium text-white hover:bg-zinc-800"
        >
          Create page
        </button>
        <p className="mt-2 text-[14px] text-zinc-500">
          After creating, go back to{" "}
          <Link href="/admin/pages" className="underline">
            Pages
          </Link>{" "}
          and click Edit on your new page.
        </p>
      </form>
    </div>
  );
}

