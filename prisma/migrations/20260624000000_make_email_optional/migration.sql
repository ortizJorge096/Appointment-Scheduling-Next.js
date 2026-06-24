-- Make client email optional across the system.
-- Postgres unique indexes allow multiple NULLs, so the existing unique index
-- on clients.email keeps real emails unique while permitting many email-less
-- clients. No data loss: existing rows already have an email.
ALTER TABLE "clients" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "clientEmail" DROP NOT NULL;

-- ── ROLLBACK (manual) ───────────────────────────────────────────────────
-- Only safe BEFORE any email-less client/appointment exists. Re-adding
-- NOT NULL will fail if any NULL emails are present (would need a backfill):
--   ALTER TABLE "appointments" ALTER COLUMN "clientEmail" SET NOT NULL;
--   ALTER TABLE "clients" ALTER COLUMN "email" SET NOT NULL;
