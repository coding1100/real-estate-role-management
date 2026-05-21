import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import {
  getBuiltInRoleId,
  permissionsInclude,
  roleRankFromBuiltInKey,
  seedTenantRoles,
} from "@/lib/tenantRoles";

export type DomainAssignment = {
  domainId: string;
  roleId: string;
  roleName: string;
  builtInKey: string | null;
  permissions: string[];
};

export type AuthContext = {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  allDomainsRoleId: string | null;
  allDomainsPermissions: string[];
  allDomainsBuiltInKey: string | null;
  assignments: DomainAssignment[];
};

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function mergePermissionSets(
  allDomains: string[],
  assignments: DomainAssignment[],
): Set<string> {
  const set = new Set<string>(allDomains);
  for (const a of assignments) {
    for (const p of a.permissions) set.add(p);
  }
  return set;
}

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
  const assignments: DomainAssignment[] = membership.domainAccess
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

export function getPermissionsForDomain(
  ctx: AuthContext,
  domainId: string,
): string[] {
  if (ctx.isPlatformAdmin) {
    return Object.values(PERMISSIONS);
  }
  if (ctx.allDomainsRoleId && ctx.allDomainsPermissions.length > 0) {
    return ctx.allDomainsPermissions;
  }
  const row = ctx.assignments.find((a) => a.domainId === domainId);
  return row?.permissions ?? [];
}

export function getCallerMaxBuiltInRank(ctx: AuthContext): number {
  if (ctx.isPlatformAdmin) return 99;
  let max = roleRankFromBuiltInKey(ctx.allDomainsBuiltInKey);
  for (const a of ctx.assignments) {
    max = Math.max(max, roleRankFromBuiltInKey(a.builtInKey));
  }
  return max;
}

export function hasTenantAdminAccess(ctx: AuthContext): boolean {
  if (ctx.isPlatformAdmin || ctx.isTenantAdmin) return true;
  return permissionsInclude(ctx.allDomainsPermissions, PERMISSIONS.TENANT_ROLES_CREATE);
}

export function can(
  ctx: AuthContext,
  perm: Permission,
  opts?: {
    domainId?: string;
    pageStatus?: "draft" | "published";
  },
): boolean {
  if (ctx.isPlatformAdmin) {
    if (
      opts?.pageStatus === "draft" &&
      perm.startsWith("pages:edit_") &&
      !perm.includes("view")
    ) {
      return true;
    }
    return true;
  }

  const check = (permissions: string[]) => {
    if (!permissionsInclude(permissions, perm)) return false;
    if (
      opts?.pageStatus === "draft" &&
      (perm.startsWith("pages:edit_") || perm === PERMISSIONS.PAGES_PUBLISH)
    ) {
      const canDraftWork =
        permissionsInclude(permissions, PERMISSIONS.PAGES_LIST_ALL) ||
        permissionsInclude(permissions, PERMISSIONS.PAGES_VIEW_DRAFT);
      if (!canDraftWork) return false;
    }
    return true;
  };

  if (opts?.domainId) {
    return check(getPermissionsForDomain(ctx, opts.domainId));
  }

  if (ctx.allDomainsPermissions.length > 0 && check(ctx.allDomainsPermissions)) {
    return true;
  }

  return ctx.assignments.some((a) => check(a.permissions));
}

export function requireCapability(
  ctx: AuthContext,
  perm: Permission,
  opts?: {
    domainId?: string;
    pageStatus?: "draft" | "published";
  },
): void {
  if (!can(ctx, perm, opts)) {
    throw new AuthError(403, "Forbidden");
  }
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

export function landingPagesListWhere(ctx: AuthContext): {
  domain?: { tenantId: string };
  domainId?: { in: string[] };
  status?: string;
  deletedAt: null | { not: null };
} {
  const restrictPublished =
    !can(ctx, PERMISSIONS.PAGES_LIST_ALL) &&
    can(ctx, PERMISSIONS.PAGES_LIST_PUBLISHED);

  const base: {
    domain: { tenantId: string };
    domainId?: { in: string[] };
    status?: string;
    deletedAt: null | { not: null };
  } = {
    domain: { tenantId: ctx.tenantId },
    deletedAt: null,
  };

  if (!ctx.allDomainsRoleId && ctx.assignments.length > 0) {
    base.domainId = { in: ctx.assignments.map((a) => a.domainId) };
  }

  if (restrictPublished) {
    base.status = "published";
  }

  return base;
}

export function canViewPageList(ctx: AuthContext): boolean {
  return (
    can(ctx, PERMISSIONS.PAGES_LIST_ALL) ||
    can(ctx, PERMISSIONS.PAGES_LIST_PUBLISHED)
  );
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

export function getEffectivePermissionUnion(ctx: AuthContext): string[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS);
  return [...mergePermissionSets(ctx.allDomainsPermissions, ctx.assignments)];
}
