-- ─────────────────────────────────────────────────────────────
-- DYNAMIC CATEGORIES
-- Migrate the hardcoded "ServiceCategory" enum to a real `categories`
-- table with FKs from services & gallery. Adds soft delete to services
-- and a service-name snapshot to appointment_services. All existing data
-- is backfilled from the old enum so nothing is lost.
-- ─────────────────────────────────────────────────────────────

-- 1. Categories table
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'promo',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_isActive_idx" ON "categories"("isActive");
CREATE INDEX "categories_deletedAt_idx" ON "categories"("deletedAt");

-- 2. Seed the 5 existing categories. slug = old enum key (preserves any
--    existing ?categoria=UNAS links). icon = predefined icon key.
INSERT INTO "categories" ("id", "name", "slug", "description", "icon", "order", "isActive", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Uñas',             'UNAS',     'Manicura, pedicura, gel, acrílico y nail art', 'manicura', 1, true, now()),
  (gen_random_uuid()::text, 'Pestañas',         'PESTANAS', 'Lifting, extensiones, volumen e híbridas',     'pestanas', 2, true, now()),
  (gen_random_uuid()::text, 'Cejas',            'CEJAS',    'Depilación, henna, diseño y laminado',         'cejas',    3, true, now()),
  (gen_random_uuid()::text, 'Corte de Cabello', 'CORTE',    'Corte, peinado y diseño de flequillo',         'corte',    4, true, now()),
  (gen_random_uuid()::text, 'Promos',           'PROMOS',   'Combos con precio especial',                   'promo',    5, true, now());

-- 3. Services: add categoryId + deletedAt, backfill from the enum, drop the enum column
ALTER TABLE "services" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "services" ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "services" s
SET "categoryId" = c."id"
FROM "categories" c
WHERE c."slug" = s."category"::text;

ALTER TABLE "services" ALTER COLUMN "category" DROP DEFAULT;
DROP INDEX IF EXISTS "services_category_idx";
ALTER TABLE "services" DROP COLUMN "category";

CREATE INDEX "services_categoryId_idx" ON "services"("categoryId");
CREATE INDEX "services_deletedAt_idx" ON "services"("deletedAt");
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Gallery: same enum → FK migration (nullable, SetNull on category delete)
ALTER TABLE "gallery_images" ADD COLUMN "categoryId" TEXT;

UPDATE "gallery_images" g
SET "categoryId" = c."id"
FROM "categories" c
WHERE g."category" IS NOT NULL AND c."slug" = g."category"::text;

DROP INDEX IF EXISTS "gallery_images_category_idx";
ALTER TABLE "gallery_images" DROP COLUMN "category";

CREATE INDEX "gallery_images_categoryId_idx" ON "gallery_images"("categoryId");
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Drop the now-unused enum type
DROP TYPE "ServiceCategory";

-- 6. Snapshot the service name on each appointment_services row (preserves
--    history if a service is later renamed or soft-deleted)
ALTER TABLE "appointment_services" ADD COLUMN "serviceName" TEXT;
UPDATE "appointment_services" aps
SET "serviceName" = s."name"
FROM "services" s
WHERE s."id" = aps."serviceId";

-- 7. New audit entity for category CRUD
ALTER TYPE "AuditEntity" ADD VALUE 'CATEGORY';
