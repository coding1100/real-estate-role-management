import "server-only";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";
import { permissionsInclude } from "@/lib/tenantRoleUtils";
import { getBuiltInRoleId, seedTenantRoles } from "@/lib/tenantRoles";

export type {
  AuthContext,
  DomainAssignment,
} from "@/lib/authContext";
export {
  AuthError,
  can,
  canViewPageList,
  getCallerMaxBuiltInRank,
  getEffectivePermissionUnion,
  getPermissionsForDomain,
  hasTenantAdminAccess,
  landingPagesListWhere,
  requireCapability,
} from "@/lib/authContext";

import type { AuthContext } from "@/lib/authContext";
import { AuthError, can, requireCapability } from "@/lib/authContext";

export async function resolveActiveTenantId(
  userId: string,
  preferredTenantId?: string | null,
): Promise<string | null> {
  if (preferredTenantId) {
    const membership = await prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: { tenantId: preferredTenantId, userId },
      },
    });
    if (membership) return preferredTenantId;

    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (user?.isPlatformAdmin) return preferredTenantId;
  }

  const first = await prisma.tenantMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true },
  });
  if (first) return first.tenantId;

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  if (user?.isPlatformAdmin) {
    const tenant = await prisma.clientTenant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return tenant?.id ?? null;
  }

  return null;
}

export async function loadUserAccess(
  userId: string,
  tenantId: string,
): Promise<AuthContext | null> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      isPlatformAdmin: true,
    },
  });
  if (!user) return null;

  const tenant = await prisma.clientTenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, isActive: true },
  });
  if (!tenant || !tenant.isActive) return null;

  let membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    include: {
      allDomainsRole: true,
      domainAccess: {
        include: {
          role: true,
          domain: { select: { tenantId: true } },
        },
      },
    },
  });

  if (!membership && user.isPlatformAdmin) {
    await seedTenantRoles(tenantId);
    const adminRoleId = await getBuiltInRoleId(tenantId, "admin");
    if (!adminRoleId) return null;
    membership = await prisma.tenantMembership.create({
      data: {
        tenantId,
        userId,
        isTenantAdmin: true,
        allDomainsRoleId: adminRoleId,
      },
      include: {
        allDomainsRole: true,
        domainAccess: {
          include: {
            role: true,
            domain: { select: { tenantId: true } },
          },
        },
      },
    });
  }

  if (!membership) return null;

  const allDomainsPermissions = membership.allDomainsRole?.permissions ?? [];
  const assignments = membership.domainAccess
    .filter((a) => a.domain.tenantId === tenantId)
    .map((a) => ({
      domainId: a.domainId,
      roleId: a.roleId,
      roleName: a.role.name,
      builtInKey: a.role.builtInKey,
      permissions: a.role.permissions,
    }));

  if (
    !membership.allDomainsRoleId &&
    assignments.length === 0 &&
    !user.isPlatformAdmin
  ) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    tenantId: tenant.id,
    tenantName: tenant.name,
    isPlatformAdmin: user.isPlatformAdmin,
    isTenantAdmin: membership.isTenantAdmin,
    allDomainsRoleId: membership.allDomainsRoleId,
    allDomainsPermissions,
    allDomainsBuiltInKey: membership.allDomainsRole?.builtInKey ?? null,
    assignments,
  };
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const tenantId = await resolveActiveTenantId(
    userId,
    session.user?.activeTenantId ?? null,
  );
  if (!tenantId) return null;

  return loadUserAccess(userId, tenantId);
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError(401, "Unauthorized");
  return ctx;
}

export async function assertDomainInTenant(
  domainId: string,
  tenantId: string,
): Promise<boolean> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { tenantId: true },
  });
  return domain?.tenantId === tenantId;
}

export async function getAccessibleDomainIds(
  ctx: AuthContext,
  perm?: Permission,
): Promise<string[]> {
  if (ctx.isPlatformAdmin) {
    const all = await prisma.domain.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true },
    });
    return all.map((d) => d.id);
  }

  if (ctx.allDomainsRoleId) {
    const all = await prisma.domain.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!perm) return all.map((d) => d.id);
    if (permissionsInclude(ctx.allDomainsPermissions, perm)) {
      return all.map((d) => d.id);
    }
    return [];
  }

  const ids = new Set<string>();
  for (const a of ctx.assignments) {
    if (!perm || permissionsInclude(a.permissions, perm)) {
      ids.add(a.domainId);
    }
  }
  return [...ids];
}

export async function listUserTenants(userId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
  }));
}
