-- ─────────────────────────────────────────────────────────────
-- LANDING STATS (singleton)
-- Editable marketing metrics for the Home/Nosotros sections. servicesCount
-- is NOT stored — it is derived live from the active service catalog.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "landing_stats" (
    "id" TEXT NOT NULL,
    "appointmentsCount" INTEGER NOT NULL DEFAULT 300,
    "clientsCount" INTEGER NOT NULL DEFAULT 180,
    "yearsExperience" INTEGER NOT NULL DEFAULT 3,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.8,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_stats_pkey" PRIMARY KEY ("id")
);

-- Seed the single row with the agreed "Intermedia" values.
INSERT INTO "landing_stats" ("id", "appointmentsCount", "clientsCount", "yearsExperience", "rating", "updatedAt")
VALUES (gen_random_uuid()::text, 300, 180, 3, 4.8, now());
