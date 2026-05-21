import { redirect } from "next/navigation";
import { RolesManager } from "@/components/admin/RolesManager";
import { can, getAuthContext } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/permissions";

export default async function RolesPage() {
  const ctx = await getAuthContext();
  if (!ctx || !can(ctx, PERMISSIONS.TENANT_ROLES_LIST)) {
    redirect("/admin");
  }

  return <RolesManager />;
}
