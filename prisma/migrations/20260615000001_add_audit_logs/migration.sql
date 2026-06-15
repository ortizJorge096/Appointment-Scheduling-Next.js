-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('APPOINTMENT', 'CLIENT', 'EXPENSE', 'SERVICE', 'GALLERY');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id"        TEXT NOT NULL,
    "action"    "AuditAction" NOT NULL,
    "entity"    "AuditEntity" NOT NULL,
    "entityId"  TEXT NOT NULL,
    "userEmail" TEXT,
    "metadata"  JSONB,
    "ip"        TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userEmail_idx" ON "audit_logs"("userEmail");
