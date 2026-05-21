import { LandingPagesV2Client } from "@/components/admin/LandingPagesV2Client";
import { loadLandingPagesList } from "@/lib/admin/loadLandingPagesList";

export default async function LandingPagesV2Page() {
  const { tablePages, pageOptions, domains, templates } =
    await loadLandingPagesList();

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
