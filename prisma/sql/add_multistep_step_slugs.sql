-- Run this in Supabase SQL Editor if the column is missing (e.g. after adding multistepStepSlugs to schema)
ALTER TABLE "LandingPage" ADD COLUMN IF NOT EXISTS "multistepStepSlugs" JSONB;
