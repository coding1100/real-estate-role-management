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

function serializeRole(role: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  builtInKey: string | null;
  isBuiltIn: boolean;
  permissions: string[];
}) {
  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    builtInKey: role.builtInKey,
    isBuiltIn: role.isBuiltIn,
    permissions: role.permissions,
  };
}

export async function GET() {
  const auth = await apiRequirePermission(PERMISSIONS.TENANT_ROLES_LIST);
  if (auth instanceof NextResponse) return auth;

  const roles = await prisma.tenantRole.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ roles: roles.map(serializeRole) });
}

export async function POST(req: NextRequest) {
  const auth = await apiRequirePermission(PERMISSIONS.TENANT_ROLES_CREATE);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const permissions = sanitizePermissions(body.permissions);

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (permissions.length === 0) {
    return NextResponse.json(
      { error: "Select at least one permission." },
      { status: 400 },
    );
  }

  const slug = normalizeRoleSlug(
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug
      : name,
  );
  if (!slug) {
    return NextResponse.json({ error: "Invalid role slug." }, { status: 400 });
  }

  if (
    !auth.isPlatformAdmin &&
    !canAssignPermissions(getEffectivePermissionUnion(auth), permissions)
  ) {
    return NextResponse.json(
      { error: "Cannot grant permissions you do not have." },
      { status: 403 },
    );
  }

  try {
    const role = await prisma.tenantRole.create({
      data: {
        tenantId: auth.tenantId,
        name,
        slug,
        description,
        isBuiltIn: false,
        permissions,
      },
    });
    return NextResponse.json({ role: serializeRole(role) }, { status: 201 });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A role with this slug already exists." },
        { status: 409 },
      );
    }
    throw e;
  }
}
