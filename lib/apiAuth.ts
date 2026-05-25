import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthContext,
  requireCapability,
  type AuthContext,
} from "@/lib/authorization";
import type { Permission } from "@/lib/permissions";
import {
  API_ERROR_CODES,
  permissionDeniedMessage,
  unauthorizedMessage,
} from "@/lib/apiMessages";

export function jsonUnauthorized() {
  return NextResponse.json(
    { error: unauthorizedMessage(), code: API_ERROR_CODES.UNAUTHORIZED },
    { status: 401 },
  );
}

export function jsonForbidden(perm?: Permission) {
  return NextResponse.json(
    {
      error: permissionDeniedMessage(perm),
      code: API_ERROR_CODES.PERMISSION_DENIED,
    },
    { status: 403 },
  );
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
      return jsonForbidden(perm);
    }
    throw e;
  }
  return auth;
}

export function handleAuthError(e: unknown): NextResponse | null {
  if (e instanceof AuthError) {
    return NextResponse.json(
      {
        error: e.message,
        code:
          e.status === 403
            ? API_ERROR_CODES.PERMISSION_DENIED
            : e.status === 401
              ? API_ERROR_CODES.UNAUTHORIZED
              : undefined,
      },
      { status: e.status },
    );
  }
  return null;
}
