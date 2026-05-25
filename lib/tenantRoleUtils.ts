import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

export const BUILT_IN_ROLE_KEYS = [
  "admin",
  "executive",
  "member",
  "explorer",
] as const;

export type BuiltInRoleKey = (typeof BUILT_IN_ROLE_KEYS)[number];

/** Built-in Admin role is locked; other built-ins and custom roles are mutable. */
export function isProtectedBuiltInRole(
  builtInKey: string | null | undefined,
): boolean {
  return builtInKey === "admin";
}

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

export function normalizeRoleSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
