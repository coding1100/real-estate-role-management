-- Add PageLayout table for storing drag and drop layout positions
CREATE TABLE "PageLayout" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "layoutData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageLayout_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for pageId
CREATE UNIQUE INDEX "PageLayout_pageId_key" ON "PageLayout"("pageId");

-- Add foreign key to LandingPage
ALTER TABLE "PageLayout" ADD CONSTRAINT "PageLayout_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
