-- ─────────────────────────────────────────────────────────────
-- FORCE PASSWORD CHANGE
-- Marker on the users table: set when an admin creates a user or resets its
-- password, cleared once the user sets their own. Enforced by the protected
-- layout guard. The model field shipped without its migration — this adds it.
-- IF NOT EXISTS keeps it safe on databases where a prior `db push` already
-- created the column.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
