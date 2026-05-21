import { redirect } from "next/navigation";
import { TeamManager } from "@/components/admin/TeamManager";
import { getAuthContext } from "@/lib/authorization";
import { can } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function TeamPage() {
  const ctx = await getAuthContext();
  if (!ctx || !can(ctx, PERMISSIONS.TEAM_LIST)) {
    redirect("/admin");
  }

  const domains = await prisma.domain.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { hostname: "asc" },
    select: { id: true, hostname: true },
  });

  return <TeamManager domains={domains} />;
}
