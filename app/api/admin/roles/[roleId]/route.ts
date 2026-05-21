import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRequirePermission } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import { getEffectivePermissionUnion } from "@/lib/authorization";
import {
  canAssignPermissions,
  normalizeRoleSlug,
  sanitizePermissions,
} from "@/lib/tenantRoleUtils";

type RouteContext = { params: Promise<{ roleId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await apiRequirePermission(PERMISSIONS.TENANT_ROLES_UPDATE);
  if (auth instanceof NextResponse) return auth;

  const { roleId } = await ctx.params;
  const existing = await prisma.tenantRole.findFirst({
    where: { id: roleId, tenantId: auth.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: {
    name?: string;
    slug?: string;
    description?: string | null;
    permissions?: string[];
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (body.permissions !== undefined) {
    const permissions = sanitizePermissions(body.permissions);
    if (permissions.length === 0) {
      return NextResponse.json(
        { error: "Select at least one permission." },
        { status: 400 },
      );
    }
    if (
      !auth.isPlatformAdmin &&
      !canAssignPermissions(getEffectivePermissionUnion(auth), permissions)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    data.permissions = permissions;
  }
  if (typeof body.slug === "string" && body.slug.trim() && !existing.isBuiltIn) {
    data.slug = normalizeRoleSlug(body.slug);
  }

  if (existing.isBuiltIn) {
    delete data.slug;
    if (data.name && existing.builtInKey) {
      const labels: Record<string, string> = {
        admin: "Admin",
        executive: "Executive",
        member: "Member",
        explorer: "Explorer",
      };
      data.name = labels[existing.builtInKey] ?? data.name;
    }
  }

  const role = await prisma.tenantRole.update({
    where: { id: roleId },
    data,
  });

  return NextResponse.json({
    role: {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      builtInKey: role.builtInKey,
      isBuiltIn: role.isBuiltIn,
      permissions: role.permissions,
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await apiRequirePermission(PERMISSIONS.TENANT_ROLES_DELETE);
  if (auth instanceof NextResponse) return auth;

  const { roleId } = await ctx.params;
  const existing = await prisma.tenantRole.findFirst({
    where: { id: roleId, tenantId: auth.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
  }
  if (existing.isBuiltIn) {
    return NextResponse.json(
      { error: "Built-in roles cannot be deleted." },
      { status: 400 },
    );
  }

  const inUse =
    (await prisma.tenantMembership.count({
      where: { allDomainsRoleId: roleId },
    })) +
    (await prisma.tenantUserDomainAccess.count({ where: { roleId } }));

  if (inUse > 0) {
    return NextResponse.json(
      { error: "Role is assigned to team members. Reassign them first." },
      { status: 400 },
    );
  }

  await prisma.tenantRole.delete({ where: { id: roleId } });
  return NextResponse.json({ ok: true });
}
