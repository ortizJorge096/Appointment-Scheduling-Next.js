-- ─────────────────────────────────────────────────────────────
-- TESTIMONIALS
-- Landing reviews, admin-managed now and client-submitted (moderated) later.
-- isActive = show/hide; deletedAt = soft delete. Audit gets a TESTIMONIAL entity.
-- ─────────────────────────────────────────────────────────────

CREATE TYPE "TestimonialSource" AS ENUM ('ADMIN', 'CLIENT');
CREATE TYPE "TestimonialStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 5,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" "TestimonialSource" NOT NULL DEFAULT 'ADMIN',
    "status" "TestimonialStatus" NOT NULL DEFAULT 'APPROVED',
    "appointmentId" TEXT,
    "clientEmail" TEXT,
    "rejectionReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "testimonials_isActive_idx"  ON "testimonials"("isActive");
CREATE INDEX "testimonials_status_idx"    ON "testimonials"("status");
CREATE INDEX "testimonials_deletedAt_idx" ON "testimonials"("deletedAt");
CREATE INDEX "testimonials_order_idx"     ON "testimonials"("order");

-- New audit entity
ALTER TYPE "AuditEntity" ADD VALUE 'TESTIMONIAL';
