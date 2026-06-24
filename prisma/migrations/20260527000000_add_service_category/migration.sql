-- Añadir categoría a los servicios (Uñas / Pestañas / Cejas / Promos)

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('UNAS', 'PESTANAS', 'CEJAS', 'PROMOS');

-- AlterTable: nueva columna con default UNAS para filas existentes
ALTER TABLE "services" ADD COLUMN "category" "ServiceCategory" NOT NULL DEFAULT 'UNAS';

-- CreateIndex
CREATE INDEX "services_category_idx" ON "services"("category");
