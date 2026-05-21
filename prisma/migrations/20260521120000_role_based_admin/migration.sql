-- CreateEnum
CREATE TYPE "AdminDomainRole" AS ENUM ('admin', 'executive', 'member', 'explorer');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "allDomainsRole" "AdminDomainRole",
ADD COLUMN "createdById" TEXT;

-- CreateTable
CREATE TABLE "AdminUserDomainAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "role" "AdminDomainRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserDomainAccess_pkey" PRIMARY KEY ("id")
);

-- Backfill existing users so login keeps working
UPDATE "AdminUser" SET "allDomainsRole" = 'admin' WHERE "allDomainsRole" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserDomainAccess_userId_domainId_key" ON "AdminUserDomainAccess"("userId", "domainId");

-- CreateIndex
CREATE INDEX "AdminUserDomainAccess_domainId_idx" ON "AdminUserDomainAccess"("domainId");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserDomainAccess" ADD CONSTRAINT "AdminUserDomainAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserDomainAccess" ADD CONSTRAINT "AdminUserDomainAccess_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
