-- CreateTable
CREATE TABLE "hero_images" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "focalPoint" TEXT NOT NULL DEFAULT 'center center',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hero_images_s3Key_key" ON "hero_images"("s3Key");

-- CreateIndex
CREATE INDEX "hero_images_isActive_idx" ON "hero_images"("isActive");
