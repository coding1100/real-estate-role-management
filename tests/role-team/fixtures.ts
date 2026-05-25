import type { AuthContext } from "@/lib/authContext";
import {
  permissionsForBuiltIn,
  type BuiltInRoleKey,
} from "@/lib/tenantRoleUtils";
import type { Permission } from "@/lib/permissions";

export const TEST_TENANT_ID = "tenant-test-001";
export const TEST_DOMAIN_A = "domain-a-001";
export const TEST_DOMAIN_B = "domain-b-002";

export function authAsBuiltIn(
  key: BuiltInRoleKey,
  opts?: {
    allDomains?: boolean;
    domainId?: string;
    isTenantAdmin?: boolean;
  },
): AuthContext {
  const permissions = permissionsForBuiltIn(key);
  const domainId = opts?.domainId ?? TEST_DOMAIN_A;
  const useAllDomains = opts?.allDomains ?? key === "admin";

  if (useAllDomains) {
    return {
      userId: `user-${key}`,
      email: `${key}@scenario.test`,
      tenantId: TEST_TENANT_ID,
      tenantName: "Scenario Tenant",
      isPlatformAdmin: false,
      isTenantAdmin: opts?.isTenantAdmin ?? key === "admin",
      allDomainsRoleId: `role-id-${key}`,
      allDomainsPermissions: permissions,
      allDomainsBuiltInKey: key,
      assignments: [],
    };
  }

  return {
    userId: `user-${key}`,
    email: `${key}@scenario.test`,
    tenantId: TEST_TENANT_ID,
    tenantName: "Scenario Tenant",
    isPlatformAdmin: false,
    isTenantAdmin: false,
    allDomainsRoleId: null,
    allDomainsPermissions: [],
    allDomainsBuiltInKey: null,
    assignments: [
      {
        domainId,
        roleId: `role-id-${key}`,
        roleName: key.charAt(0).toUpperCase() + key.slice(1),
        builtInKey: key,
        permissions,
      },
    ],
  };
}

export function authAsCustom(
  permissions: Permission[],
  opts?: { domainId?: string; allDomains?: boolean },
): AuthContext {
  const domainId = opts?.domainId ?? TEST_DOMAIN_A;
  const useAllDomains = opts?.allDomains === true;

  if (useAllDomains) {
    return {
      userId: "user-custom",
      email: "custom@scenario.test",
      tenantId: TEST_TENANT_ID,
      tenantName: "Scenario Tenant",
      isPlatformAdmin: false,
      isTenantAdmin: false,
      allDomainsRoleId: "role-id-custom",
      allDomainsPermissions: permissions,
      allDomainsBuiltInKey: null,
      assignments: [],
    };
  }

  return {
    userId: "user-custom",
    email: "custom@scenario.test",
    tenantId: TEST_TENANT_ID,
    tenantName: "Scenario Tenant",
    isPlatformAdmin: false,
    isTenantAdmin: false,
    allDomainsRoleId: null,
    allDomainsPermissions: [],
    allDomainsBuiltInKey: null,
    assignments: [
      {
        domainId,
        roleId: "role-id-custom",
        roleName: "Custom Test Role",
        builtInKey: null,
        permissions,
      },
    ],
  };
}

export function authAsExecutiveOnTwoDomains(): AuthContext {
  const permissions = permissionsForBuiltIn("executive");
  return {
    userId: "user-executive-multi",
    email: "executive@scenario.test",
    tenantId: TEST_TENANT_ID,
    tenantName: "Scenario Tenant",
    isPlatformAdmin: false,
    isTenantAdmin: false,
    allDomainsRoleId: null,
    allDomainsPermissions: [],
    allDomainsBuiltInKey: null,
    assignments: [
      {
        domainId: TEST_DOMAIN_A,
        roleId: "role-id-executive",
        roleName: "Executive",
        builtInKey: "executive",
        permissions,
      },
      {
        domainId: TEST_DOMAIN_B,
        roleId: "role-id-executive",
        roleName: "Executive",
        builtInKey: "executive",
        permissions,
      },
    ],
  };
}
