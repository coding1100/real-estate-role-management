import "server-only";

import { prisma } from "@/lib/prisma";
import type { BuiltInRoleKey } from "@/lib/tenantRoleUtils";
import {
  BUILT_IN_ROLE_KEYS,
  permissionsForBuiltIn,
} from "@/lib/tenantRoleUtils";

export type { BuiltInRoleKey } from "@/lib/tenantRoleUtils";
export {
  ALL_PERMISSION_IDS,
  BUILT_IN_ROLE_KEYS,
  canAssignPermissions,
  isValidPermission,
  normalizeRoleSlug,
  permissionsInclude,
  permissionsForBuiltIn,
  roleRankFromBuiltInKey,
  sanitizePermissions,
} from "@/lib/tenantRoleUtils";

const BUILT_IN_LABELS: Record<BuiltInRoleKey, string> = {
  admin: "Admin",
  executive: "Executive",
  member: "Member",
  explorer: "Explorer",
};

export async function seedTenantRoles(tenantId: string): Promise<void> {
  for (const key of BUILT_IN_ROLE_KEYS) {
    const perms = permissionsForBuiltIn(key);
    await prisma.tenantRole.upsert({
      where: {
        tenantId_slug: { tenantId, slug: key },
      },
      update: {
        name: BUILT_IN_LABELS[key],
        builtInKey: key,
        isBuiltIn: true,
        permissions: perms,
      },
      create: {
        tenantId,
        slug: key,
        name: BUILT_IN_LABELS[key],
        builtInKey: key,
        isBuiltIn: true,
        permissions: perms,
      },
    });
  }
}

export async function getBuiltInRoleId(
  tenantId: string,
  key: BuiltInRoleKey,
): Promise<string | null> {
  const row = await prisma.tenantRole.findUnique({
    where: { tenantId_slug: { tenantId, slug: key } },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function ensureDefaultTenant(): Promise<string> {
  const tenant = await prisma.clientTenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Client",
      slug: "default",
    },
  });
  await seedTenantRoles(tenant.id);
  return tenant.id;
}
