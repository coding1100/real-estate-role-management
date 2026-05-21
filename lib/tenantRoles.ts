import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type AdminDomainRole,
  type Permission,
} from "@/lib/permissions";

export const BUILT_IN_ROLE_KEYS = [
  "admin",
  "executive",
  "member",
  "explorer",
] as const;

export type BuiltInRoleKey = (typeof BUILT_IN_ROLE_KEYS)[number];

const BUILT_IN_LABELS: Record<BuiltInRoleKey, string> = {
  admin: "Admin",
  executive: "Executive",
  member: "Member",
  explorer: "Explorer",
};

const TENANT_ADMIN_EXTRA: Permission[] = [
  PERMISSIONS.TENANT_ROLES_LIST,
  PERMISSIONS.TENANT_ROLES_CREATE,
  PERMISSIONS.TENANT_ROLES_UPDATE,
  PERMISSIONS.TENANT_ROLES_DELETE,
];

export const ALL_PERMISSION_IDS: Permission[] = Object.values(PERMISSIONS);

export function isValidPermission(value: string): value is Permission {
  return (ALL_PERMISSION_IDS as string[]).includes(value);
}

export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<Permission>();
  for (const item of input) {
    if (typeof item === "string" && isValidPermission(item)) {
      out.add(item);
    }
  }
  return [...out];
}

export function permissionsForBuiltIn(key: BuiltInRoleKey): Permission[] {
  const base = [...ROLE_PERMISSIONS[key]];
  if (key === "admin") {
    for (const p of TENANT_ADMIN_EXTRA) {
      if (!base.includes(p)) base.push(p);
    }
  }
  return base;
}

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

export function roleRankFromBuiltInKey(key: string | null | undefined): number {
  const ranks: Record<string, number> = {
    explorer: 1,
    member: 2,
    executive: 3,
    admin: 4,
  };
  return key && key in ranks ? ranks[key] : 0;
}

export function permissionsInclude(
  permissions: readonly string[],
  perm: Permission,
): boolean {
  return permissions.includes(perm);
}

export function canAssignPermissions(
  callerPermissions: readonly string[],
  targetPermissions: readonly string[],
): boolean {
  const caller = new Set(callerPermissions);
  return targetPermissions.every((p) => caller.has(p));
}

export function maxBuiltInKeyFromPermissions(
  permissions: readonly string[],
): BuiltInRoleKey | null {
  let best: BuiltInRoleKey | null = null;
  let bestRank = 0;
  for (const key of BUILT_IN_ROLE_KEYS) {
    const set = ROLE_PERMISSIONS[key];
    const contained = [...set].every((p) => permissions.includes(p));
    if (contained) {
      const rank = roleRankFromBuiltInKey(key);
      if (rank > bestRank) {
        bestRank = rank;
        best = key;
      }
    }
  }
  return best;
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

export function normalizeRoleSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
