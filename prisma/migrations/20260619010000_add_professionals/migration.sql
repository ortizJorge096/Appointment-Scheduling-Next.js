-- CreateTable: professionals
CREATE TABLE "professionals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professionals_isActive_idx" ON "professionals"("isActive");

-- AddColumn: professionalId on appointments
ALTER TABLE "appointments" ADD COLUMN "professionalId" TEXT;

-- CreateIndex
CREATE INDEX "appointments_professionalId_idx" ON "appointments"("professionalId");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum: add PROFESSIONAL to AuditEntity
ALTER TYPE "AuditEntity" ADD VALUE 'PROFESSIONAL';
