-- ─────────────────────────────────────────────────────────────
-- PROFESSIONAL SOFT DELETE
-- Adds deletedAt so professionals can be retired without losing the row.
-- Historical appointments keep their professionalId (no SetNull, no orphans).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "professionals" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "professionals_deletedAt_idx" ON "professionals"("deletedAt");
