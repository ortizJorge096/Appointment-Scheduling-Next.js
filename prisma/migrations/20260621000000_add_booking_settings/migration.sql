-- CreateTable: booking flow toggle (singleton) — whether /agendar shows the
-- professional-selection step
CREATE TABLE "booking_settings" (
    "id" TEXT NOT NULL,
    "showProfessionalStep" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "booking_settings" ("id", "showProfessionalStep", "updatedAt") VALUES
  (gen_random_uuid()::text, true, now());
