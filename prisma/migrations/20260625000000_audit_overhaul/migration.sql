-- Audit overhaul: richer, queryable audit trail.
-- All additions are backward-compatible (new enum values + nullable columns).

-- New actor enum (who performed the action)
CREATE TYPE "AuditActor" AS ENUM ('ADMIN', 'CLIENT', 'SYSTEM');

-- Extend existing enums. ADD VALUE is allowed in a transaction on PG 12+ as long
-- as the new values aren't used in this same migration (they are not).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CANCEL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_FAILED';
ALTER TYPE "AuditEntity" ADD VALUE IF NOT EXISTS 'AUTH';
ALTER TYPE "AuditEntity" ADD VALUE IF NOT EXISTS 'EMAIL';

-- New columns — all nullable, so existing rows are untouched.
ALTER TABLE "audit_logs"
  ADD COLUMN "actorType"   "AuditActor",
  ADD COLUMN "userAgent"   TEXT,
  ADD COLUMN "before"      JSONB,
  ADD COLUMN "after"       JSONB,
  ADD COLUMN "description" TEXT;

-- Backfill: every historical entry was an admin action.
UPDATE "audit_logs" SET "actorType" = 'ADMIN' WHERE "actorType" IS NULL;

-- Index for filtering by actor in the audit view.
CREATE INDEX "audit_logs_actorType_idx" ON "audit_logs" ("actorType");

-- ── ROLLBACK (manual) ───────────────────────────────────────────────────
-- Columns/index drop cleanly; enum ADD VALUE is NOT reversible in Postgres
-- (would require recreating the enum type). Safe to leave the extra values.
--   DROP INDEX "audit_logs_actorType_idx";
--   ALTER TABLE "audit_logs" DROP COLUMN "actorType", DROP COLUMN "userAgent",
--     DROP COLUMN "before", DROP COLUMN "after", DROP COLUMN "description";
--   DROP TYPE "AuditActor";
