import { describe, expect, it } from "vitest";
import { assertPagePatchAllowed } from "@/lib/pagePatchAuth";
import { AuthError } from "@/lib/authContext";
import { PERMISSIONS } from "@/lib/permissions";
import { recordScenario } from "./report";
import { TEST_DOMAIN_A, authAsBuiltIn } from "./fixtures";

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

function patchDenied(
  fn: () => void,
): { denied: boolean; message: string } {
  try {
    fn();
    return { denied: false, message: "no error" };
  } catch (e) {
    if (e instanceof AuthError && e.status === 403) {
      return { denied: true, message: e.message };
    }
    throw e;
  }
}

describe("Page PATCH authorization by role", () => {
  it("PATCH-001: explorer cannot PATCH published page content", () => {
    const ctx = authAsBuiltIn("explorer");
    const { denied, message } = patchDenied(() =>
      assertPagePatchAllowed(
        ctx,
        { headline: "Updated" },
        { domainId: TEST_DOMAIN_A, pageStatus: "published" },
      ),
    );
    assertScenario(
      "PATCH-001",
      "Pages",
      "Explorer blocked from editing published content",
      "explorer",
      "403 denied",
      denied,
      message,
    );
  });

  it("PATCH-002: member can PATCH published content", () => {
    const ctx = authAsBuiltIn("member");
    let ok = true;
    try {
      assertPagePatchAllowed(
        ctx,
        { headline: "Updated" },
        { domainId: TEST_DOMAIN_A, pageStatus: "published" },
      );
    } catch {
      ok = false;
    }
    assertScenario(
      "PATCH-002",
      "Pages",
      "Member can edit published content",
      "member",
      "allowed",
      ok,
      ok ? "allowed" : "denied",
    );
  });

  it("PATCH-003: member cannot publish via status", () => {
    const ctx = authAsBuiltIn("member");
    const { denied } = patchDenied(() =>
      assertPagePatchAllowed(
        ctx,
        { status: "published" },
        { domainId: TEST_DOMAIN_A, pageStatus: "draft" },
      ),
    );
    assertScenario(
      "PATCH-003",
      "Pages",
      "Member cannot set status published",
      "member",
      "403 denied",
      denied,
      denied ? "denied" : "allowed",
    );
  });

  it("PATCH-004: executive can publish", () => {
    const ctx = authAsBuiltIn("executive");
    let ok = true;
    try {
      assertPagePatchAllowed(
        ctx,
        { status: "published" },
        { domainId: TEST_DOMAIN_A, pageStatus: "draft" },
      );
    } catch {
      ok = false;
    }
    assertScenario(
      "PATCH-004",
      "Pages",
      "Executive can publish draft page",
      "executive",
      "allowed",
      ok,
      ok ? "allowed" : "denied",
    );
  });

  it("PATCH-005: explorer cannot PATCH draft page at all", () => {
    const ctx = authAsBuiltIn("explorer");
    const { denied } = patchDenied(() =>
      assertPagePatchAllowed(
        ctx,
        { notes: "test" },
        { domainId: TEST_DOMAIN_A, pageStatus: "draft" },
      ),
    );
    assertScenario(
      "PATCH-005",
      "Pages",
      "Explorer blocked from any draft PATCH",
      "explorer",
      "403 denied",
      denied,
      denied ? "denied" : "allowed",
    );
  });
});
