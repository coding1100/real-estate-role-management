import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordScenario } from "./report";
import { TEST_TENANT_ID } from "./fixtures";

const prismaMock = vi.hoisted(() => ({
  tenantMembership: {
    findUnique: vi.fn(),
  },
  tenantRole: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  assertTeamMemberRemovable,
  assertTeamMemberUpdateAllowed,
  memberHasAdminRole,
  TeamValidationError,
} from "@/lib/team";

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
  expect(pass, `${id}: ${name}`).toBe(true);
}

describe("Team guards (DB mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GUARD-001: cannot remove admin-role member", async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      allDomainsRole: { builtInKey: "admin", slug: "admin" },
      domainAccess: [],
    });

    let message = "";
    try {
      await assertTeamMemberRemovable(TEST_TENANT_ID, "user-admin");
    } catch (e) {
      if (e instanceof TeamValidationError) message = e.message;
    }
    const blocked = message.includes("cannot be removed");
    assertScenario(
      "GUARD-001",
      "Team",
      "Admin member removal blocked",
      "tenant admin",
      "TeamValidationError 400",
      blocked,
      blocked ? message : "no error",
    );
  });

  it("GUARD-002: can remove member-role assignee", async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      allDomainsRole: null,
      domainAccess: [{ role: { builtInKey: "member", slug: "member" } }],
    });

    let threw = false;
    try {
      await assertTeamMemberRemovable(TEST_TENANT_ID, "user-member");
    } catch {
      threw = true;
    }
    assertScenario(
      "GUARD-002",
      "Team",
      "Member assignee can be removed",
      "tenant admin",
      "no error",
      !threw,
      threw ? "blocked" : "allowed",
    );
  });

  it("GUARD-003: cannot keep admin member on admin role (update blocked)", async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      allDomainsRole: { builtInKey: "admin", slug: "admin" },
      domainAccess: [],
    });
    prismaMock.tenantRole.findMany.mockResolvedValue([
      { builtInKey: "admin" },
    ]);

    let message = "";
    try {
      await assertTeamMemberUpdateAllowed(TEST_TENANT_ID, "user-admin", {
        allDomains: true,
        allDomainsRoleId: "role-admin-id",
        assignmentRoleIds: [],
      });
    } catch (e) {
      if (e instanceof TeamValidationError) message = e.message;
    }
    const blocked = message.includes("Admin role");
    assertScenario(
      "GUARD-003",
      "Team",
      "Updating admin member while staying on Admin blocked",
      "tenant admin",
      "TeamValidationError 400",
      blocked,
      blocked ? message : "no error",
    );
  });

  it("GUARD-004: demoting admin to member role is allowed by guard", async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      allDomainsRole: { builtInKey: "admin", slug: "admin" },
      domainAccess: [],
    });
    prismaMock.tenantRole.findMany.mockResolvedValue([
      { builtInKey: "member" },
    ]);

    let threw = false;
    try {
      await assertTeamMemberUpdateAllowed(TEST_TENANT_ID, "user-admin", {
        allDomains: true,
        allDomainsRoleId: "role-member-id",
        assignmentRoleIds: [],
      });
    } catch {
      threw = true;
    }
    assertScenario(
      "GUARD-004",
      "Team",
      "Demote admin to member allowed at guard layer",
      "tenant admin",
      "no error from assertTeamMemberUpdateAllowed",
      !threw,
      threw ? "blocked" : "allowed",
    );
  });

  it("GUARD-005: explorer assignee is removable", async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      allDomainsRole: null,
      domainAccess: [{ role: { builtInKey: "explorer", slug: "explorer" } }],
    });

    let threw = false;
    try {
      await assertTeamMemberRemovable(TEST_TENANT_ID, "user-explorer");
    } catch {
      threw = true;
    }
    assertScenario(
      "GUARD-005",
      "Team",
      "Explorer team member can be removed",
      "tenant admin",
      "removal allowed",
      !threw,
      threw ? "blocked" : "allowed",
    );
  });

  it("GUARD-006: executive domain assignee is removable", async () => {
    prismaMock.tenantMembership.findUnique.mockResolvedValue({
      allDomainsRole: null,
      domainAccess: [{ role: { builtInKey: "executive", slug: "executive" } }],
    });

    let threw = false;
    try {
      await assertTeamMemberRemovable(TEST_TENANT_ID, "user-exec");
    } catch {
      threw = true;
    }
    assertScenario(
      "GUARD-006",
      "Team",
      "Executive assignee can be removed",
      "tenant admin",
      "removal allowed",
      !threw,
      threw ? "blocked" : "allowed",
    );
  });
});
