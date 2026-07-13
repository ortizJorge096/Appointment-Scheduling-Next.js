-- Shared rate-limit counters (Postgres) so anti-abuse limits are consistent
-- across the 2+ replicas the app runs with, instead of per-pod in-memory Maps.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_resetAt_idx" ON "rate_limits"("resetAt");
