import { getPermissionLabel, type Permission } from "@/lib/permissions";

export const API_ERROR_CODES = {
  PERMISSION_DENIED: "PERMISSION_DENIED",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

export type ApiErrorBody = {
  error?: string;
  code?: string;
};

export function permissionDeniedMessage(perm?: Permission): string {
  if (perm) {
    return `You do not have permission to ${getPermissionLabel(perm).toLowerCase()}.`;
  }
  return "You do not have permission to perform this action.";
}

export function unauthorizedMessage(): string {
  return "Please sign in to continue.";
}

export function apiErrorTitle(status: number): string {
  if (status === 403) return "Permission denied";
  if (status === 401) return "Sign in required";
  if (status === 404) return "Not found";
  if (status === 409) return "Conflict";
  if (status >= 500) return "Server error";
  return "Request failed";
}

export function getApiErrorMessage(
  status: number,
  body?: ApiErrorBody | null,
  fallback?: string,
): string {
  if (body?.error && body.error.trim()) return body.error.trim();
  if (status === 403) return permissionDeniedMessage();
  if (status === 401) return unauthorizedMessage();
  if (fallback) return fallback;
  return "Something went wrong. Please try again.";
}

export async function parseApiErrorBody(
  res: Response,
  parsed?: unknown,
): Promise<ApiErrorBody> {
  if (parsed && typeof parsed === "object") {
    return parsed as ApiErrorBody;
  }
  try {
    return (await res.json()) as ApiErrorBody;
  } catch {
    return {};
  }
}
