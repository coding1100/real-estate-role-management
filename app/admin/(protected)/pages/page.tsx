import { AddPageDialog } from "@/components/admin/AddPageDialog";
import { PagesTable } from "@/components/admin/PagesTable";
import { loadLandingPagesList } from "@/lib/admin/loadLandingPagesList";

export default async function AdminPagesListPage() {
  const { tablePages, pageOptions, domains, templates } =
    await loadLandingPagesList();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          Landing pages
        </h1>
        <AddPageDialog
          domains={domains}
          templates={templates}
          defaultTemplate="buyer"
          pages={pageOptions}
        />
      </div>
      <PagesTable pages={tablePages} />
    </div>
  );
}
