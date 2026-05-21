import type { AdminDomainRole } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      activeTenantId?: string;
      tenantId?: string;
      tenantName?: string;
      isPlatformAdmin?: boolean;
      isTenantAdmin?: boolean;
      tenants?: { id: string; name: string; slug: string }[];
      /** @deprecated Phase 1 — use tenant roles */
      allDomainsRole?: AdminDomainRole | null;
      /** @deprecated Phase 1 */
      domainAccess?: { domainId: string; role: AdminDomainRole }[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    activeTenantId?: string;
  }
}
