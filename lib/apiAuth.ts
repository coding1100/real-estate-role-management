import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthContext,
  requireCapability,
  type AuthContext,
} from "@/lib/authorization";
import type { Permission } from "@/lib/permissions";

export function jsonUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function apiRequireAuth(): Promise<AuthContext | NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) return jsonUnauthorized();
  return ctx;
}

export async function apiRequirePermission(
  perm: Permission,
  opts?: {
    domainId?: string;
    pageStatus?: "draft" | "published";
  },
): Promise<AuthContext | NextResponse> {
  const auth = await apiRequireAuth();
  if (auth instanceof NextResponse) return auth;
  try {
    requireCapability(auth, perm, opts);
  } catch (e) {
    if (e instanceof AuthError && e.status === 403) {
      return jsonForbidden();
    }
    throw e;
  }
  return auth;
}

export function handleAuthError(e: unknown): NextResponse | null {
  if (e instanceof AuthError) {
    return NextResponse.json(
      { error: e.message },
      { status: e.status },
    );
  }
  return null;
}
