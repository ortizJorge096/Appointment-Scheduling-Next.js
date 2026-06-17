-- Replace ServiceCategory enum with the studio's marketing categories
-- (Manicura, Pedicura, Cejas y Pestañas, Depilación, Corte, VIP) and remap
-- existing rows. Uses the new-type swap pattern so it runs in one transaction
-- (no "ALTER TYPE ... ADD VALUE" restriction).

CREATE TYPE "ServiceCategory_new" AS ENUM ('MANICURA', 'PEDICURA', 'CEJAS_PESTANAS', 'DEPILACION', 'CORTE', 'VIP');

-- services.category (NOT NULL, previously defaulted to UNAS)
ALTER TABLE "services" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "services" ALTER COLUMN "category" TYPE "ServiceCategory_new" USING (
  CASE "category"::text
    WHEN 'UNAS'     THEN 'MANICURA'
    WHEN 'PESTANAS' THEN 'CEJAS_PESTANAS'
    WHEN 'CEJAS'    THEN 'CEJAS_PESTANAS'
    WHEN 'PROMOS'   THEN 'VIP'
    ELSE 'MANICURA'
  END
)::"ServiceCategory_new";
ALTER TABLE "services" ALTER COLUMN "category" SET DEFAULT 'MANICURA';

-- gallery_images.category (nullable)
ALTER TABLE "gallery_images" ALTER COLUMN "category" TYPE "ServiceCategory_new" USING (
  CASE "category"::text
    WHEN 'UNAS'     THEN 'MANICURA'
    WHEN 'PESTANAS' THEN 'CEJAS_PESTANAS'
    WHEN 'CEJAS'    THEN 'CEJAS_PESTANAS'
    WHEN 'PROMOS'   THEN 'VIP'
    ELSE NULL
  END
)::"ServiceCategory_new";

DROP TYPE "ServiceCategory";
ALTER TYPE "ServiceCategory_new" RENAME TO "ServiceCategory";
