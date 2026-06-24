-- ─────────────────────────────────────────────────────────────
-- BOOKING HORIZON
-- How many days into the future clients can book. Editable from admin (7–365).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "booking_settings" ADD COLUMN "maxAdvanceDays" INTEGER NOT NULL DEFAULT 90;
