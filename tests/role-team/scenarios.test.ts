import { describe, expect, it } from "vitest";
import { can, canViewPageList, getCallerMaxBuiltInRank, getEffectivePermissionUnion, hasTenantAdminAccess } from "@/lib/authContext";
import { PERMISSIONS, ROLE_PERMISSIONS, roleHasPermission, canAssignRole } from "@/lib/permissions";
import {
  canAssignPermissions,
  isProtectedBuiltInRole,
  permissionsForBuiltIn,
  roleRankFromBuiltInKey,
} from "@/lib/tenantRoleUtils";
import { recordScenario } from "./report";

function memberHasAdminRole(m: {
  allDomainsRole: { builtInKey: string | null; slug: string } | null;
  domainAccess: { role: { builtInKey: string | null; slug: string } }[];
}): boolean {
  if (isProtectedBuiltInRole(m.allDomainsRole?.builtInKey)) return true;
  return m.domainAccess.some((a) =>
    isProtectedBuiltInRole(a.role.builtInKey),
  );
}
import {
  TEST_DOMAIN_A,
  TEST_DOMAIN_B,
  authAsBuiltIn,
  authAsCustom,
  authAsExecutiveOnTwoDomains,
} from "./fixtures";

function assertScenario(
  id: string,
  category: string,
  name: string,
  actor: string,
  expected: string,
  pass: boolean,
  actual: string,
) {
  recordScenario({ id, category, name, actor, expected, actual, pass });
  expect(pass, `${id}: ${name} — expected ${expected}, got ${actual}`).toBe(true);
}

describe("Built-in roles — permission matrix", () => {
  const builtIns = ["explorer", "member", "executive", "admin"] as const;

  it("built-in permission sets match ROLE_PERMISSIONS", () => {
    for (const key of builtIns) {
      const fromUtil = new Set(permissionsForBuiltIn(key));
      const fromLib = ROLE_PERMISSIONS[key];
      const match =
        key === "admin"
          ? [...fromLib].every((p) => fromUtil.has(p)) &&
            fromUtil.size >= fromLib.size
          : fromUtil.size === fromLib.size &&
            [...fromUtil].every((p) => fromLib.has(p));
      assertScenario(
        `ROLE-001-${key}`,
        "Roles",
        `${key} permissionsForBuiltIn matches ROLE_PERMISSIONS`,
        key,
        key === "admin"
          ? "admin includes tenant role extras"
          : "sets are identical",
        match,
        match ? "ok" : "mismatch",
      );
    }
  });

  const pageCases: {
    id: string;
    role: (typeof builtIns)[number];
    perm: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
    pageStatus?: "draft" | "published";
    allowed: boolean;
  }[] = [
    {
      id: "PAGE-001",
      role: "explorer",
      perm: PERMISSIONS.PAGES_EDIT_CONTENT,
      pageStatus: "published",
      allowed: false,
    },
    {
      id: "PAGE-002",
      role: "explorer",
      perm: PERMISSIONS.PAGES_PUBLISH,
      pageStatus: "published",
      allowed: false,
    },
    {
      id: "PAGE-003",
      role: "explorer",
      perm: PERMISSIONS.PAGES_VIEW_LIVE,
      pageStatus: "published",
      allowed: true,
    },
    {
      id: "PAGE-004",
      role: "member",
      perm: PERMISSIONS.PAGES_EDIT_CONTENT,
      pageStatus: "published",
      allowed: true,
    },
    {
      id: "PAGE-005",
      role: "member",
      perm: PERMISSIONS.PAGES_PUBLISH,
      pageStatus: "published",
      allowed: false,
    },
    {
      id: "PAGE-006",
      role: "member",
      perm: PERMISSIONS.PAGES_EDIT_CONTENT,
      pageStatus: "draft",
      allowed: false,
    },
    {
      id: "PAGE-007",
      role: "executive",
      perm: PERMISSIONS.PAGES_PUBLISH,
      pageStatus: "draft",
      allowed: true,
    },
    {
      id: "PAGE-008",
      role: "executive",
      perm: PERMISSIONS.PAGES_CREATE,
      pageStatus: "published",
      allowed: true,
    },
    {
      id: "PAGE-009",
      role: "admin",
      perm: PERMISSIONS.TENANT_ROLES_CREATE,
      pageStatus: "published",
      allowed: true,
    },
  ];

  for (const c of pageCases) {
    it(`${c.id}: ${c.role} — ${c.perm}`, () => {
      const ctx = authAsBuiltIn(c.role, {
        allDomains: c.role === "admin",
        domainId: TEST_DOMAIN_A,
      });
      const result = can(ctx, c.perm, {
        domainId: TEST_DOMAIN_A,
        pageStatus: c.pageStatus,
      });
      assertScenario(
        c.id,
        "Pages",
        `${c.role} ${c.perm} (${c.pageStatus ?? "any"})`,
        c.role,
        c.allowed ? "allowed" : "denied",
        result === c.allowed,
        result ? "allowed" : "denied",
      );
    });
  }
});

describe("Team management — who can manage team & roles", () => {
  const teamCases: {
    id: string;
    role: "explorer" | "member" | "executive" | "admin";
    perm: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
    allowed: boolean;
  }[] = [
    { id: "TEAM-001", role: "explorer", perm: PERMISSIONS.TEAM_LIST, allowed: false },
    { id: "TEAM-002", role: "explorer", perm: PERMISSIONS.TEAM_CREATE, allowed: false },
    { id: "TEAM-003", role: "member", perm: PERMISSIONS.TEAM_CREATE, allowed: false },
    { id: "TEAM-004", role: "member", perm: PERMISSIONS.TEAM_UPDATE, allowed: false },
    { id: "TEAM-005", role: "executive", perm: PERMISSIONS.TEAM_CREATE, allowed: false },
    { id: "TEAM-006", role: "executive", perm: PERMISSIONS.TENANT_ROLES_LIST, allowed: false },
    { id: "TEAM-007", role: "admin", perm: PERMISSIONS.TEAM_LIST, allowed: true },
    { id: "TEAM-008", role: "admin", perm: PERMISSIONS.TEAM_CREATE, allowed: true },
    { id: "TEAM-009", role: "admin", perm: PERMISSIONS.TENANT_ROLES_CREATE, allowed: true },
  ];

  for (const c of teamCases) {
    it(`${c.id}: ${c.role} ${c.perm}`, () => {
      const ctx = authAsBuiltIn(c.role, { allDomains: c.role === "admin" });
      const result = can(ctx, c.perm);
      assertScenario(
        c.id,
        "Team",
        `${c.role} can ${c.perm}`,
        c.role,
        c.allowed ? "allowed" : "denied",
        result === c.allowed,
        result ? "allowed" : "denied",
      );
    });
  }

  it("TEAM-010: tenant admin flag grants role management", () => {
    const ctx = authAsBuiltIn("executive", { isTenantAdmin: true, allDomains: true });
    const hasAccess = hasTenantAdminAccess(ctx);
    assertScenario(
      "TEAM-010",
      "Team",
      "Executive with isTenantAdmin has tenant admin access",
      "executive (tenant admin)",
      "hasTenantAdminAccess true",
      hasAccess,
      hasAccess ? "true" : "false",
    );
  });
});

describe("Role assignment hierarchy", () => {
  it("RANK-001: built-in ranks order explorer < member < executive < admin", () => {
    const order = ["explorer", "member", "executive", "admin"] as const;
    let ok = true;
    for (let i = 1; i < order.length; i++) {
      if (
        roleRankFromBuiltInKey(order[i - 1]) >=
        roleRankFromBuiltInKey(order[i])
      ) {
        ok = false;
      }
    }
    assertScenario(
      "RANK-001",
      "Roles",
      "Built-in role ranks increase correctly",
      "system",
      "strict ascending ranks",
      ok,
      ok ? "ordered" : "broken order",
    );
  });

  const assignCases: {
    id: string;
    caller: "explorer" | "member" | "executive" | "admin";
    target: "explorer" | "member" | "executive" | "admin";
    allowed: boolean;
  }[] = [
    { id: "RANK-002", caller: "explorer", target: "member", allowed: false },
    { id: "RANK-003", caller: "member", target: "executive", allowed: false },
    { id: "RANK-004", caller: "member", target: "explorer", allowed: true },
    { id: "RANK-005", caller: "executive", target: "member", allowed: true },
    { id: "RANK-006", caller: "executive", target: "admin", allowed: false },
    { id: "RANK-007", caller: "admin", target: "executive", allowed: true },
  ];

  for (const c of assignCases) {
    it(`${c.id}: ${c.caller} assigns ${c.target}`, () => {
      const allowed = canAssignRole(c.caller, c.target);
      assertScenario(
        c.id,
        "Roles",
        `${c.caller} may assign ${c.target} role (legacy canAssignRole)`,
        c.caller,
        c.allowed ? "allowed" : "denied",
        allowed === c.allowed,
        allowed ? "allowed" : "denied",
      );
    });
  }

  it("RANK-008: member caller rank blocks assigning executive permissions", () => {
    const ctx = authAsBuiltIn("member");
    const callerRank = getCallerMaxBuiltInRank(ctx);
    const targetRank = roleRankFromBuiltInKey("executive");
    const blocked = targetRank > callerRank;
    assertScenario(
      "RANK-008",
      "Roles",
      "Member cannot assign executive-level built-in role",
      "member",
      "target rank > caller rank",
      blocked,
      blocked ? "blocked" : "allowed",
    );
  });
});

describe("Custom roles — assign subsets", () => {
  const viewOnlyPerms = [
    PERMISSIONS.PAGES_LIST_PUBLISHED,
    PERMISSIONS.PAGES_VIEW_LIVE,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PLATFORM_LOGIN,
    PERMISSIONS.PLATFORM_LOGOUT,
  ] as const;

  it("CUSTOM-001: view-only custom role cannot edit content", () => {
    const ctx = authAsCustom([...viewOnlyPerms]);
    const edit = can(ctx, PERMISSIONS.PAGES_EDIT_CONTENT, {
      domainId: TEST_DOMAIN_A,
      pageStatus: "published",
    });
    const view = can(ctx, PERMISSIONS.PAGES_VIEW_LIVE, {
      domainId: TEST_DOMAIN_A,
      pageStatus: "published",
    });
    assertScenario(
      "CUSTOM-001",
      "Custom roles",
      "View-only custom role denied edit content",
      "custom (view only)",
      "edit denied",
      !edit,
      edit ? "allowed" : "denied",
    );
    assertScenario(
      "CUSTOM-002",
      "Custom roles",
      "View-only custom role can view live",
      "custom (view only)",
      "view allowed",
      view,
      view ? "allowed" : "denied",
    );
  });

  it("CUSTOM-003: executive cannot grant permissions they lack", () => {
    const ctx = authAsBuiltIn("executive");
    const callerPerms = getEffectivePermissionUnion(ctx);
    const wantsTeamCreate = [PERMISSIONS.TEAM_CREATE];
    const canGrant = canAssignPermissions(callerPerms, wantsTeamCreate);
    assertScenario(
      "CUSTOM-003",
      "Custom roles",
      "Executive cannot create role with team:create",
      "executive",
      "canAssignPermissions false",
      !canGrant,
      canGrant ? "can grant" : "cannot grant",
    );
  });

  it("CUSTOM-004: admin can grant member-level page permissions", () => {
    const ctx = authAsBuiltIn("admin", { allDomains: true });
    const callerPerms = getEffectivePermissionUnion(ctx);
    const memberSubset = [
      PERMISSIONS.PAGES_EDIT_CONTENT,
      PERMISSIONS.PAGES_VIEW_LIVE,
    ];
    const canGrant = canAssignPermissions(callerPerms, memberSubset);
    assertScenario(
      "CUSTOM-004",
      "Custom roles",
      "Admin can grant member page permissions to custom role",
      "admin",
      "canAssignPermissions true",
      canGrant,
      canGrant ? "can grant" : "cannot grant",
    );
  });
});

describe("Admin protection — team UI rules", () => {
  it("ADMIN-001: only built-in admin role is protected", () => {
    const onlyAdmin = isProtectedBuiltInRole("admin");
    const execNot = !isProtectedBuiltInRole("executive");
    const pass = onlyAdmin && execNot;
    assertScenario(
      "ADMIN-001",
      "Team",
      "isProtectedBuiltInRole only locks admin",
      "system",
      "admin protected, executive not",
      pass,
      pass ? "correct" : "incorrect",
    );
  });

  it("ADMIN-002: member with admin role is protected from removal", () => {
    const protectedMember = memberHasAdminRole({
      allDomainsRole: { builtInKey: "admin", slug: "admin" },
      domainAccess: [],
    });
    const normalMember = !memberHasAdminRole({
      allDomainsRole: null,
      domainAccess: [{ role: { builtInKey: "member", slug: "member" } }],
    });
    assertScenario(
      "ADMIN-002",
      "Team",
      "Admin role member is protected",
      "admin assignee",
      "memberHasAdminRole true",
      protectedMember,
      protectedMember ? "protected" : "not protected",
    );
    assertScenario(
      "ADMIN-003",
      "Team",
      "Member role assignee is not protected",
      "member assignee",
      "memberHasAdminRole false",
      normalMember,
      normalMember ? "not protected" : "protected",
    );
  });
});

describe("Domain-scoped access", () => {
  it("DOMAIN-001: executive on two domains has publish on both", () => {
    const ctx = authAsExecutiveOnTwoDomains();
    const a = can(ctx, PERMISSIONS.PAGES_PUBLISH, {
      domainId: TEST_DOMAIN_A,
      pageStatus: "draft",
    });
    const b = can(ctx, PERMISSIONS.PAGES_PUBLISH, {
      domainId: TEST_DOMAIN_B,
      pageStatus: "draft",
    });
    assertScenario(
      "DOMAIN-001",
      "Domains",
      "Executive publish on domain A",
      "executive (domain A)",
      "allowed",
      a,
      a ? "allowed" : "denied",
    );
    assertScenario(
      "DOMAIN-002",
      "Domains",
      "Executive publish on domain B",
      "executive (domain B)",
      "allowed",
      b,
      b ? "allowed" : "denied",
    );
  });

  it("DOMAIN-003: explorer can view page list (published only)", () => {
    const ctx = authAsBuiltIn("explorer");
    const list = canViewPageList(ctx);
    const listAll = can(ctx, PERMISSIONS.PAGES_LIST_ALL);
    assertScenario(
      "DOMAIN-003",
      "Domains",
      "Explorer can view pages list (published)",
      "explorer",
      "canViewPageList true",
      list,
      list ? "allowed" : "denied",
    );
    assertScenario(
      "DOMAIN-004",
      "Domains",
      "Explorer cannot list all statuses",
      "explorer",
      "PAGES_LIST_ALL denied",
      !listAll,
      listAll ? "allowed" : "denied",
    );
  });
});

describe("Legacy roleHasPermission parity", () => {
  it("LEGACY-001: each built-in roleHasPermission matches can()", () => {
    const checks: Permission[] = [
      PERMISSIONS.PAGES_EDIT_CONTENT,
      PERMISSIONS.TEAM_CREATE,
      PERMISSIONS.WEBHOOKS_LIST,
    ];
    for (const role of ["explorer", "member", "executive", "admin"] as const) {
      const ctx = authAsBuiltIn(role, { allDomains: role === "admin" });
      for (const perm of checks) {
        const legacy = roleHasPermission(role, perm);
        const modern = can(ctx, perm);
        assertScenario(
          `LEGACY-001-${role}-${perm}`,
          "Roles",
          `${role} roleHasPermission(${perm}) === can()`,
          role,
          String(legacy),
          legacy === modern,
          `legacy=${legacy} can=${modern}`,
        );
      }
    }
  });
});
