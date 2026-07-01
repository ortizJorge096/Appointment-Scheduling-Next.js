-- The professional-selection step is now OFF by default (opt-in from the admin).
ALTER TABLE "booking_settings" ALTER COLUMN "showProfessionalStep" SET DEFAULT false;

-- Turn it off on the existing singleton row too; re-enable from the admin toggle.
UPDATE "booking_settings" SET "showProfessionalStep" = false;
