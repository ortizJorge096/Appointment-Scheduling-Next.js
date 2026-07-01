-- ─────────────────────────────────────────────────────────────
-- APPOINTMENT ORIGIN
-- Explicit provenance for each appointment, set at creation time — no fragile
-- field-combination heuristics going forward.
--
-- Backfill of existing rows uses the one reliable signal available: the public
-- booking flow ALWAYS creates source = 'ONLINE', so any other source was
-- admin-created → MANUAL. ONLINE rows are ambiguous (public or manual-online)
-- and default to PUBLIC ("unknown origin assumed public"). Legacy VIP/PAST
-- can't be recovered reliably, so they fold into PUBLIC/MANUAL.
-- ─────────────────────────────────────────────────────────────

CREATE TYPE "AppointmentOrigin" AS ENUM ('PUBLIC', 'MANUAL', 'VIP', 'PAST');

ALTER TABLE "appointments"
  ADD COLUMN "origin" "AppointmentOrigin" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX "appointments_origin_idx" ON "appointments"("origin");

-- Backfill legacy rows (see note above).
UPDATE "appointments" SET "origin" = 'MANUAL' WHERE "source" <> 'ONLINE';
