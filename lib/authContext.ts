import { permissionDeniedMessage } from "@/lib/apiMessages";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { permissionsInclude, roleRankFromBuiltInKey } from "@/lib/tenantRoleUtils";

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
  return permissionsInclude(
    ctx.allDomainsPermissions,
    PERMISSIONS.TENANT_ROLES_CREATE,
  );
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
    throw new AuthError(403, permissionDeniedMessage(perm));
  }
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

export function getEffectivePermissionUnion(ctx: AuthContext): string[] {
  if (ctx.isPlatformAdmin) return Object.values(PERMISSIONS);
  return [...mergePermissionSets(ctx.allDomainsPermissions, ctx.assignments)];
}
