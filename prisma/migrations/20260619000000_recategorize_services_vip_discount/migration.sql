-- Recreate ServiceCategory enum with the new catalog structure
-- (UNAS, PESTANAS, CEJAS, CORTE, PROMOS). Old values are mapped to the
-- closest new category; prisma/seed.ts then corrects each service's
-- category individually by upserting on its (unique) name.
ALTER TYPE "ServiceCategory" RENAME TO "ServiceCategory_old";
CREATE TYPE "ServiceCategory" AS ENUM ('UNAS', 'PESTANAS', 'CEJAS', 'CORTE', 'PROMOS');

ALTER TABLE "services" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "services" ALTER COLUMN "category" TYPE "ServiceCategory" USING (
  CASE "category"::text
    WHEN 'MANICURA'       THEN 'UNAS'
    WHEN 'PEDICURA'       THEN 'UNAS'
    WHEN 'CEJAS_PESTANAS' THEN 'CEJAS'
    WHEN 'DEPILACION'     THEN 'CEJAS'
    WHEN 'CORTE'          THEN 'CORTE'
    WHEN 'VIP'            THEN 'PROMOS'
    ELSE 'UNAS'
  END
)::"ServiceCategory";
ALTER TABLE "services" ALTER COLUMN "category" SET DEFAULT 'UNAS';

ALTER TABLE "gallery_images" ALTER COLUMN "category" TYPE "ServiceCategory" USING (
  CASE "category"::text
    WHEN 'MANICURA'       THEN 'UNAS'
    WHEN 'PEDICURA'       THEN 'UNAS'
    WHEN 'CEJAS_PESTANAS' THEN 'CEJAS'
    WHEN 'DEPILACION'     THEN 'CEJAS'
    WHEN 'CORTE'          THEN 'CORTE'
    WHEN 'VIP'            THEN 'PROMOS'
    ELSE NULL
  END
)::"ServiceCategory";

DROP TYPE "ServiceCategory_old";

-- AddColumn: VIP discount snapshot on the appointment
ALTER TABLE "appointments" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: VIP discount toggle (singleton)
CREATE TABLE "vip_discount_config" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_discount_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VIP discount tiers (minServices -> discountPct)
CREATE TABLE "vip_discount_tiers" (
    "id" TEXT NOT NULL,
    "minServices" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL,

    CONSTRAINT "vip_discount_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vip_discount_tiers_minServices_key" ON "vip_discount_tiers"("minServices");

-- Seed default tiers: 2 -> 10%, 3 -> 20%, 4+ -> 30%
INSERT INTO "vip_discount_tiers" ("id", "minServices", "discountPct") VALUES
  (gen_random_uuid()::text, 2, 10),
  (gen_random_uuid()::text, 3, 20),
  (gen_random_uuid()::text, 4, 30);

INSERT INTO "vip_discount_config" ("id", "enabled", "updatedAt") VALUES
  (gen_random_uuid()::text, true, now());
