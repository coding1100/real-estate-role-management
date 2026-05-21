CREATE TABLE IF NOT EXISTS "LeadDispatchJob" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadDispatchJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadDispatchJob_leadId_fkey"
    FOREIGN KEY ("leadId")
    REFERENCES "Lead" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadDispatchJob_leadId_jobType_key"
  ON "LeadDispatchJob"("leadId", "jobType");

CREATE INDEX IF NOT EXISTS "LeadDispatchJob_status_nextRunAt_idx"
  ON "LeadDispatchJob"("status", "nextRunAt");
