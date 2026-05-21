"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type AuthContext } from "@/lib/authContext";
import type { Permission } from "@/lib/permissions";

const AuthContextReact = createContext<AuthContext | null>(null);

export function AuthProvider({
  value,
  children,
}: {
  value: AuthContext;
  children: ReactNode;
}) {
  return (
    <AuthContextReact.Provider value={value}>{children}</AuthContextReact.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(AuthContextReact);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useCan(
  perm: Permission,
  opts?: { domainId?: string; pageStatus?: "draft" | "published" },
): boolean {
  const ctx = useAuth();
  return can(ctx, perm, opts);
}
