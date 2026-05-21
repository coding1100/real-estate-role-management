ALTER TABLE "LandingPage"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "archivedSlug" TEXT;

CREATE INDEX "LandingPage_domainId_deletedAt_idx"
ON "LandingPage"("domainId", "deletedAt");
