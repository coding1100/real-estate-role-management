-- AlterTable
ALTER TABLE "LandingPage" ADD COLUMN IF NOT EXISTS "adminListOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: stable order by createdAt within each domain
UPDATE "LandingPage" p
SET "adminListOrder" = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "domainId" ORDER BY "createdAt" ASC) - 1)::int AS rn
  FROM "LandingPage"
) sub
WHERE p.id = sub.id;
