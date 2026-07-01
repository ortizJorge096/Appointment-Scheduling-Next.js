-- ─────────────────────────────────────────────────────────────
-- ADMIN MANAGEMENT
-- Extends the existing users table (no parallel Admin model): soft-deactivation,
-- last-login tracking and a password-change marker used to invalidate stale JWTs.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN "isActive"          BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "lastLoginAt"        TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "passwordChangedAt"  TIMESTAMP(3);

-- Ensure at least one SUPER_ADMIN exists so admin management isn't locked out.
-- If none is set yet, promote the earliest-created admin.
UPDATE "users" SET "role" = 'SUPER_ADMIN'
WHERE "id" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'SUPER_ADMIN');
