import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiRequirePermission } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  TeamValidationError,
  assertTeamMemberRemovable,
  assertTeamMemberUpdateAllowed,
  assertCanManageTeam,
  resolveMembershipIsTenantAdmin,
  validateTeamCreate,
  type CreateTeamMemberInput,
  type ProposedTeamMembership,
} from "@/lib/team";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await apiRequirePermission(PERMISSIONS.TEAM_UPDATE);
  if (auth instanceof NextResponse) return auth;

  const { userId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: auth.tenantId, userId } },
    include: { user: true, allDomainsRole: true, domainAccess: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    await assertCanManageTeam(auth);
  } catch (e) {
    if (e instanceof TeamValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  if (typeof body.name === "string" && body.name.trim()) {
    await prisma.adminUser.update({
      where: { id: userId },
      data: { name: body.name.trim() },
    });
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  const roleId = typeof body.roleId === "string" ? body.roleId.trim() : null;
  const allDomains = body.allDomains;
  const assignmentsRaw = Array.isArray(body.assignments) ? body.assignments : null;

  if (roleId || allDomains !== undefined || assignmentsRaw !== null) {
    const nextRoleId =
      roleId ?? membership.allDomainsRoleId ?? "";
    const nextAllDomains =
      allDomains === true
        ? true
        : allDomains === false
          ? false
          : membership.allDomainsRoleId != null;

    if (!nextRoleId && nextAllDomains) {
      return NextResponse.json({ error: "roleId is required." }, { status: 400 });
    }

    const input: CreateTeamMemberInput = {
      email: membership.user.email,
      name: membership.user.name,
      password: "unused",
      roleId: nextRoleId,
      allDomains: nextAllDomains,
      assignments: [],
    };

    if (!nextAllDomains) {
      const rows =
        assignmentsRaw?.map((row) => {
          if (!row || typeof row !== "object") return null;
          const domainId = String((row as { domainId?: unknown }).domainId ?? "");
          const assignmentRoleId = String((row as { roleId?: unknown }).roleId ?? "");
          if (!domainId || !assignmentRoleId) return null;
          return { domainId, roleId: assignmentRoleId };
        }).filter(Boolean) ??
        membership.domainAccess.map((a) => ({
          domainId: a.domainId,
          roleId: a.roleId,
        }));

      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Select at least one domain when All domains is off." },
          { status: 400 },
        );
      }
      input.assignments = rows as CreateTeamMemberInput["assignments"];
    }

    const proposed: ProposedTeamMembership = {
      allDomains: nextAllDomains,
      allDomainsRoleId: nextAllDomains ? nextRoleId : null,
      assignmentRoleIds: nextAllDomains
        ? []
        : (input.assignments ?? []).map((a) => a.roleId),
    };

    try {
      await assertTeamMemberUpdateAllowed(auth.tenantId, userId, proposed);
    } catch (e) {
      if (e instanceof TeamValidationError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    await validateTeamCreate(auth, input);

    const isTenantAdmin = await resolveMembershipIsTenantAdmin(
      auth.tenantId,
      proposed,
    );

    await prisma.tenantUserDomainAccess.deleteMany({
      where: { tenantId: auth.tenantId, userId },
    });

    await prisma.tenantMembership.update({
      where: { id: membership.id },
      data: {
        allDomainsRoleId: nextAllDomains ? nextRoleId : null,
        isTenantAdmin,
        domainAccess: nextAllDomains
          ? undefined
          : {
              create: (input.assignments ?? []).map((a) => ({
                domainId: a.domainId,
                roleId: a.roleId,
              })),
            },
      },
    });
  }

  const updated = await prisma.tenantMembership.findUnique({
    where: { id: membership.id },
    include: {
      user: true,
      allDomainsRole: true,
      domainAccess: {
        include: {
          domain: { select: { hostname: true } },
          role: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json({
    user: updated
      ? {
          id: updated.user.id,
          email: updated.user.email,
          name: updated.user.name,
          allDomains: !!updated.allDomainsRole,
          roleId: updated.allDomainsRole?.id,
          roleName: updated.allDomainsRole?.name,
        }
      : null,
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await apiRequirePermission(PERMISSIONS.TEAM_REMOVE);
  if (auth instanceof NextResponse) return auth;

  const { userId } = await ctx.params;
  if (userId === auth.userId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the team." },
      { status: 400 },
    );
  }

  try {
    await assertTeamMemberRemovable(auth.tenantId, userId);
  } catch (e) {
    if (e instanceof TeamValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  await prisma.tenantMembership.delete({
    where: { tenantId_userId: { tenantId: auth.tenantId, userId } },
  });

  return NextResponse.json({ ok: true });
}
