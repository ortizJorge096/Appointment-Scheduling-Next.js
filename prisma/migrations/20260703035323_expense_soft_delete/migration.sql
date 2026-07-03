-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "totalDurationMinutes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "appointment_services_serviceName_idx" ON "appointment_services" USING GIN ("serviceName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "appointments_clientName_idx" ON "appointments" USING GIN ("clientName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "expenses_deletedAt_idx" ON "expenses"("deletedAt");
