-- =============================================================================
-- PageLayout: create table and save layout positions (grid structure)
-- Run this if the table does not exist (e.g. before running migrations).
-- =============================================================================

-- 1) Create the table (only if it does not exist)
CREATE TABLE IF NOT EXISTS "PageLayout" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "layoutData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PageLayout_pageId_key" ON "PageLayout"("pageId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PageLayout_pageId_fkey'
    ) THEN
        ALTER TABLE "PageLayout"
        ADD CONSTRAINT "PageLayout_pageId_fkey"
        FOREIGN KEY ("pageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- =============================================================================
-- 2) Save layout positions for a page (run with your pageId and layout JSON)
-- =============================================================================

-- Insert new layout (when the page has no layout yet):
-- INSERT INTO "PageLayout" ("id", "pageId", "layoutData", "createdAt", "updatedAt")
-- VALUES (
--     gen_random_uuid()::text,
--     'YOUR_PAGE_ID_HERE',
--     '[
--         {"i":"header-bar","x":0,"y":0,"w":12,"h":2,"static":true},
--         {"i":"footer-bar","x":0,"y":8,"w":12,"h":2,"static":true},
--         {"i":"text-container","x":0,"y":2,"w":8,"h":6,"minW":4,"minH":3},
--         {"i":"form-container","x":8,"y":2,"w":4,"h":6,"minW":4,"minH":3}
--     ]'::jsonb,
--     CURRENT_TIMESTAMP,
--     CURRENT_TIMESTAMP
-- )
-- ON CONFLICT ("pageId") DO UPDATE SET
--     "layoutData" = EXCLUDED."layoutData",
--     "updatedAt" = CURRENT_TIMESTAMP;

-- Update existing layout (upsert by pageId):
-- INSERT INTO "PageLayout" ("id", "pageId", "layoutData", "createdAt", "updatedAt")
-- VALUES (
--     COALESCE((SELECT "id" FROM "PageLayout" WHERE "pageId" = 'YOUR_PAGE_ID_HERE'), gen_random_uuid()::text),
--     'YOUR_PAGE_ID_HERE',
--     '[
--         {"i":"header-bar","x":0,"y":0,"w":12,"h":2,"static":true},
--         {"i":"footer-bar","x":0,"y":8,"w":12,"h":2,"static":true},
--         {"i":"text-container","x":0,"y":2,"w":8,"h":6,"minW":4,"minH":3},
--         {"i":"form-container","x":8,"y":2,"w":4,"h":6,"minW":4,"minH":3}
--     ]'::jsonb,
--     CURRENT_TIMESTAMP,
--     CURRENT_TIMESTAMP
-- )
-- ON CONFLICT ("pageId") DO UPDATE SET
--     "layoutData" = EXCLUDED."layoutData",
--     "updatedAt" = CURRENT_TIMESTAMP;

-- =============================================================================
-- 3) Single upsert query (PostgreSQL) – replace :pageId and :layoutJson
-- =============================================================================
-- INSERT INTO "PageLayout" ("id", "pageId", "layoutData", "createdAt", "updatedAt")
-- VALUES (
--     gen_random_uuid()::text,
--     :pageId,
--     :layoutJson::jsonb,
--     CURRENT_TIMESTAMP,
--     CURRENT_TIMESTAMP
-- )
-- ON CONFLICT ("pageId") DO UPDATE SET
--     "layoutData" = EXCLUDED."layoutData",
--     "updatedAt" = CURRENT_TIMESTAMP;
