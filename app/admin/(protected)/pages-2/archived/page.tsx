import { redirect } from "next/navigation";
import { LandingPagesV2Client } from "@/components/admin/LandingPagesV2Client";
import { loadLandingPagesList } from "@/lib/admin/loadLandingPagesList";
import { can, getAuthContext } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/permissions";

export default async function ArchivedLandingPagesV2Page() {
  const ctx = await getAuthContext();
  if (!ctx || !can(ctx, PERMISSIONS.PAGES_LIST_ARCHIVED)) {
    redirect("/admin");
  }

  const { tablePages, pageOptions, domains, templates } =
    await loadLandingPagesList(ctx, "archived");

  return (
    <div className="min-h-full bg-[#F8F9FA]">
      <LandingPagesV2Client
        pages={tablePages}
        viewMode="archived"
        domains={domains}
        templates={templates}
        pageOptions={pageOptions}
      />
    </div>
  );
}
