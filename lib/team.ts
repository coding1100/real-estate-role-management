import { permissionDeniedMessage } from "@/lib/apiMessages";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import {
  can,
  getCallerMaxBuiltInRank,
  getEffectivePermissionUnion,
  hasTenantAdminAccess,
  type AuthContext,
} from "@/lib/authContext";
import { getAccessibleDomainIds } from "@/lib/authorization";
import type { Permission } from "@/lib/permissions";
import {
  canAssignPermissions,
  isProtectedBuiltInRole,
  isValidPermission,
  roleRankFromBuiltInKey,
  type BuiltInRoleKey,
} from "@/lib/tenantRoleUtils";
import { getBuiltInRoleId } from "@/lib/tenantRoles";

export type TeamAssignmentInput = {
  domainId: string;
  roleId: string;
};

export type CreateTeamMemberInput = {
  email: string;
  name: string;
  password: string;
  allDomains: boolean;
  roleId: string;
  assignments?: TeamAssignmentInput[];
};

export class TeamValidationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function assertCanManageTeam(ctx: AuthContext): Promise<void> {
  if (!can(ctx, PERMISSIONS.TEAM_CREATE)) {
    throw new TeamValidationError(
      403,
      permissionDeniedMessage(PERMISSIONS.TEAM_CREATE),
    );
  }
}

async function getRoleInTenant(tenantId: string, roleId: string) {
  return prisma.tenantRole.findFirst({
    where: { id: roleId, tenantId },
  });
}

async function assertCanAssignRole(
  ctx: AuthContext,
  roleId: string,
): Promise<void> {
  const role = await getRoleInTenant(ctx.tenantId, roleId);
  if (!role) {
    throw new TeamValidationError(400, "Invalid role for this tenant.");
  }

  if (ctx.isPlatformAdmin || ctx.isTenantAdmin) return;

  const callerPerms = getEffectivePermissionUnion(ctx);
  const targetPerms = role.permissions.filter((p): p is Permission =>
    isValidPermission(p),
  );
  if (!canAssignPermissions(callerPerms, targetPerms)) {
    throw new TeamValidationError(
      403,
      "Permission denied. You cannot assign a role with permissions you do not have.",
    );
  }

  const targetRank = roleRankFromBuiltInKey(role.builtInKey);
  const callerRank = getCallerMaxBuiltInRank(ctx);
  if (targetRank > callerRank) {
    throw new TeamValidationError(
      403,
      "Cannot assign a role above your own level.",
    );
  }

  if (
    role.builtInKey === "admin" &&
    role.isBuiltIn &&
    !hasTenantAdminAccess(ctx)
  ) {
    throw new TeamValidationError(
      403,
      "Only tenant admins can assign the Admin role.",
    );
  }
}

export async function validateTeamCreate(
  ctx: AuthContext,
  input: CreateTeamMemberInput,
): Promise<void> {
  await assertCanManageTeam(ctx);
  await assertCanAssignRole(ctx, input.roleId);

  if (!input.allDomains) {
    const assignments = input.assignments ?? [];
    if (assignments.length === 0) {
      throw new TeamValidationError(
        400,
        "Select at least one domain when All domains is off.",
      );
    }
    const accessible = new Set(await getAccessibleDomainIds(ctx));
    for (const a of assignments) {
      if (!accessible.has(a.domainId)) {
        throw new TeamValidationError(
          403,
          "Cannot assign domains you do not have access to.",
        );
      }
      await assertCanAssignRole(ctx, a.roleId);
    }
  }
}

/** True when the member is assigned the built-in Admin role (not custom roles). */
export function memberHasAdminRole(m: {
  allDomainsRole: { builtInKey: string | null; slug: string } | null;
  domainAccess: { role: { builtInKey: string | null; slug: string } }[];
}): boolean {
  if (isProtectedBuiltInRole(m.allDomainsRole?.builtInKey)) return true;
  return m.domainAccess.some((a) =>
    isProtectedBuiltInRole(a.role.builtInKey),
  );
}

/** @deprecated Use memberHasAdminRole */
export function isProtectedTeamMember(m: {
  isTenantAdmin?: boolean;
  allDomainsRole: { builtInKey: string | null; slug: string } | null;
  domainAccess: { role: { builtInKey: string | null; slug: string } }[];
}): boolean {
  return memberHasAdminRole(m);
}

export type ProposedTeamMembership = {
  allDomains: boolean;
  allDomainsRoleId: string | null;
  assignmentRoleIds: string[];
};

async function proposedRolesIncludeAdmin(
  tenantId: string,
  proposed: ProposedTeamMembership,
): Promise<boolean> {
  const roleIds = proposed.allDomains
    ? proposed.allDomainsRoleId
      ? [proposed.allDomainsRoleId]
      : []
    : proposed.assignmentRoleIds;
  if (roleIds.length === 0) return false;
  const roles = await prisma.tenantRole.findMany({
    where: { tenantId, id: { in: roleIds } },
    select: { builtInKey: true },
  });
  return roles.some((r) => isProtectedBuiltInRole(r.builtInKey));
}

async function loadMembershipForTeamGuard(tenantId: string, userId: string) {
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    include: {
      allDomainsRole: { select: { builtInKey: true, slug: true } },
      domainAccess: {
        include: { role: { select: { builtInKey: true, slug: true } } },
      },
    },
  });
  if (!membership) {
    throw new TeamValidationError(404, "User not found.");
  }
  return membership;
}

export async function assertTeamMemberRemovable(
  tenantId: string,
  userId: string,
): Promise<void> {
  const membership = await loadMembershipForTeamGuard(tenantId, userId);
  if (memberHasAdminRole(membership)) {
    throw new TeamValidationError(
      400,
      "Members with the Admin role cannot be removed.",
    );
  }
}

export async function assertTeamMemberUpdateAllowed(
  tenantId: string,
  userId: string,
  proposed: ProposedTeamMembership,
): Promise<void> {
  const membership = await loadMembershipForTeamGuard(tenantId, userId);
  const currentlyAdmin = memberHasAdminRole(membership);
  const nextAdmin = await proposedRolesIncludeAdmin(tenantId, proposed);

  if (currentlyAdmin && nextAdmin) {
    throw new TeamValidationError(
      400,
      "This member has the Admin role. Choose a non-Admin role to change their access, or leave Admin unchanged.",
    );
  }
}

export async function resolveMembershipIsTenantAdmin(
  tenantId: string,
  proposed: ProposedTeamMembership,
): Promise<boolean> {
  return proposedRolesIncludeAdmin(tenantId, proposed);
}

/** @deprecated Use assertTeamMemberRemovable */
export async function assertNotLastTenantAdmin(
  tenantId: string,
  userId: string,
): Promise<void> {
  await assertTeamMemberRemovable(tenantId, userId);
}

export async function migrateLegacyUsersToTenant(
  tenantId: string,
): Promise<void> {
  const users = await prisma.adminUser.findMany({
    include: { domainAccess: true },
  });

  for (const user of users) {
    const existing = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    if (existing) continue;

    let allDomainsRoleId: string | null = null;
    if (user.allDomainsRole) {
      allDomainsRoleId = await getBuiltInRoleId(
        tenantId,
        user.allDomainsRole as BuiltInRoleKey,
      );
    } else if (
      (user as { isPlatformAdmin?: boolean }).isPlatformAdmin ||
      user.role === "admin"
    ) {
      allDomainsRoleId = await getBuiltInRoleId(tenantId, "admin");
    }

    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId,
        userId: user.id,
        allDomainsRoleId,
        isTenantAdmin:
          !!(user as { isPlatformAdmin?: boolean }).isPlatformAdmin ||
          user.allDomainsRole === "admin" ||
          user.role === "admin",
      },
    });

    for (const access of user.domainAccess) {
      const domain = await prisma.domain.findUnique({
        where: { id: access.domainId },
        select: { tenantId: true },
      });
      if (domain?.tenantId !== tenantId) continue;

      const roleId = await getBuiltInRoleId(
        tenantId,
        access.role as BuiltInRoleKey,
      );
      if (!roleId) continue;

      await prisma.tenantUserDomainAccess.create({
        data: {
          tenantId,
          userId: user.id,
          domainId: access.domainId,
          roleId,
        },
      });
    }

    if (!membership.allDomainsRoleId && user.domainAccess.length === 0) {
      await prisma.tenantMembership.delete({
        where: { id: membership.id },
      });
    }
  }
}
