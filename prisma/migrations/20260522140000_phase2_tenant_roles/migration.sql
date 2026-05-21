-- Phase 2: ClientTenant, TenantRole, tenant-scoped access

CREATE TABLE "ClientTenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientTenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientTenant_slug_key" ON "ClientTenant"("slug");

INSERT INTO "ClientTenant" ("id", "name", "slug", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Default Client', 'default', true, NOW(), NOW());

-- Add tenantId to Domain (nullable first)
ALTER TABLE "Domain" ADD COLUMN "tenantId" TEXT;

UPDATE "Domain" SET "tenantId" = (SELECT "id" FROM "ClientTenant" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenantId" IS NULL;

ALTER TABLE "Domain" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Domain" DROP CONSTRAINT IF EXISTS "Domain_hostname_key";
CREATE UNIQUE INDEX "Domain_tenantId_hostname_key" ON "Domain"("tenantId", "hostname");
CREATE INDEX "Domain_tenantId_idx" ON "Domain"("tenantId");

ALTER TABLE "Domain" ADD CONSTRAINT "Domain_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "ClientTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Platform admin flag
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AdminUser" SET "isPlatformAdmin" = true
WHERE "allDomainsRole" = 'admin' OR "role" = 'admin';

CREATE TABLE "TenantRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "builtInKey" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantRole_tenantId_slug_key" ON "TenantRole"("tenantId", "slug");
CREATE INDEX "TenantRole_tenantId_idx" ON "TenantRole"("tenantId");

ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "ClientTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allDomainsRoleId" TEXT,
    "isTenantAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");
CREATE INDEX "TenantMembership_userId_idx" ON "TenantMembership"("userId");

ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "ClientTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_allDomainsRoleId_fkey"
  FOREIGN KEY ("allDomainsRoleId") REFERENCES "TenantRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TenantUserDomainAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantUserDomainAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantUserDomainAccess_userId_domainId_key" ON "TenantUserDomainAccess"("userId", "domainId");
CREATE INDEX "TenantUserDomainAccess_tenantId_idx" ON "TenantUserDomainAccess"("tenantId");
CREATE INDEX "TenantUserDomainAccess_domainId_idx" ON "TenantUserDomainAccess"("domainId");

ALTER TABLE "TenantUserDomainAccess" ADD CONSTRAINT "TenantUserDomainAccess_tenantId_userId_fkey"
  FOREIGN KEY ("tenantId", "userId") REFERENCES "TenantMembership"("tenantId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantUserDomainAccess" ADD CONSTRAINT "TenantUserDomainAccess_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantUserDomainAccess" ADD CONSTRAINT "TenantUserDomainAccess_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "TenantRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
