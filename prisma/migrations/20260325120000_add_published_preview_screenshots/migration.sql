-- Add published preview screenshot fields
ALTER TABLE "LandingPage"
ADD COLUMN IF NOT EXISTS "publishedPreviewImageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "publishedPreviewThumbUrl" TEXT,
ADD COLUMN IF NOT EXISTS "publishedPreviewCapturedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "publishedPreviewError" TEXT;
