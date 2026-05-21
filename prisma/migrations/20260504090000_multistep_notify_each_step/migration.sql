-- AlterTable
ALTER TABLE "LandingPage" ADD COLUMN IF NOT EXISTS "multistepNotifyEachStep" BOOLEAN NOT NULL DEFAULT false;
