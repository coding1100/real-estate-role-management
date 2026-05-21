import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { apiRequirePermission } from "@/lib/apiAuth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  CreateTeamMemberInput,
  TeamValidationError,
  validateTeamCreate,
} from "@/lib/team";

function serializeMember(m: {
  id: string;
  userId: string;
  isTenantAdmin: boolean;
  user: { id: string; email: string; name: string; createdAt: Date };
  allDomainsRole: {
    id: string;
    name: string;
    slug: string;
    builtInKey: string | null;
  } | null;
  domainAccess: {
    domainId: string;
    roleId: string;
    domain: { hostname: string };
    role: { id: string; name: string; slug: string };
  }[];
}) {
  return {
    id: m.user.id,
    membershipId: m.id,
    email: m.user.email,
    name: m.user.name,
    isTenantAdmin: m.isTenantAdmin,
    createdAt: m.user.createdAt.toISOString(),
    allDomains: !!m.allDomainsRole,
    roleId: m.allDomainsRole?.id ?? null,
    roleName: m.allDomainsRole?.name ?? null,
    assignments: m.domainAccess.map((a) => ({
      domainId: a.domainId,
      roleId: a.roleId,
      roleName: a.role.name,
      hostname: a.domain.hostname,
    })),
  };
}

export async function GET() {
  const auth = await apiRequirePermission(PERMISSIONS.TEAM_LIST);
  if (auth instanceof NextResponse) return auth;

  const members = await prisma.tenantMembership.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "asc" },
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
    users: members.map(serializeMember),
  });
}

export async function POST(req: NextRequest) {
  const auth = await apiRequirePermission(PERMISSIONS.TEAM_CREATE);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const roleId = String(body.roleId ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const allDomains = body.allDomains === true;

  if (!email || !name || !password || !roleId) {
    return NextResponse.json(
      { error: "email, name, password, and roleId are required." },
      { status: 400 },
    );
  }

  const assignments = Array.isArray(body.assignments)
    ? body.assignments
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const domainId = String((row as { domainId?: unknown }).domainId ?? "");
          const assignmentRoleId = String((row as { roleId?: unknown }).roleId ?? "");
          if (!domainId || !assignmentRoleId) return null;
          return { domainId, roleId: assignmentRoleId };
        })
        .filter(Boolean)
    : [];

  const input: CreateTeamMemberInput = {
    email,
    name,
    password,
    roleId,
    allDomains,
    assignments: assignments as CreateTeamMemberInput["assignments"],
  };

  try {
    await validateTeamCreate(auth, input);
  } catch (e) {
    if (e instanceof TeamValidationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.adminUser.create({
      data: {
        email,
        name,
        passwordHash,
        createdById: auth.userId,
      },
    });
  } else {
    const existingMembership = await prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: { tenantId: auth.tenantId, userId: user.id },
      },
    });
    if (existingMembership) {
      return NextResponse.json(
        { error: "User is already on this team." },
        { status: 409 },
      );
    }
  }

  const membership = await prisma.tenantMembership.create({
    data: {
      tenantId: auth.tenantId,
      userId: user.id,
      allDomainsRoleId: allDomains ? roleId : null,
      isTenantAdmin: false,
      domainAccess: allDomains
        ? undefined
        : {
            create: (input.assignments ?? []).map((a) => ({
              tenantId: auth.tenantId,
              userId: user!.id,
              domainId: a.domainId,
              roleId: a.roleId,
            })),
          },
    },
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

  return NextResponse.json({ user: serializeMember(membership) }, { status: 201 });
}
