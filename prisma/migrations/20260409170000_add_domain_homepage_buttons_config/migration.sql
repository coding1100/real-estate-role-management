ALTER TABLE "Domain"
ADD COLUMN IF NOT EXISTS "defaultHomepageButtons" JSONB;
