import { redirect } from "next/navigation";
import { LandingPagesV2Client } from "@/components/admin/LandingPagesV2Client";
import { loadLandingPagesList } from "@/lib/admin/loadLandingPagesList";
import { canViewPageList, getAuthContext } from "@/lib/authorization";

export default async function LandingPagesV2Page() {
  const ctx = await getAuthContext();
  if (!ctx || !canViewPageList(ctx)) {
    redirect("/admin");
  }

  const { tablePages, pageOptions, domains, templates } =
    await loadLandingPagesList(ctx);

  return (
    <div className="min-h-full bg-[#F8F9FA]">
      <LandingPagesV2Client
        pages={tablePages}
        viewMode="active"
        domains={domains}
        templates={templates}
        pageOptions={pageOptions}
      />
    </div>
  );
}
