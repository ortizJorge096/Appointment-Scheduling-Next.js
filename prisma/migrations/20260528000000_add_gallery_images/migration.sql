-- Galería de imágenes administrable desde el panel

CREATE TABLE "gallery_images" (
    "id"        TEXT             NOT NULL,
    "title"     TEXT,
    "category"  "ServiceCategory",
    "s3Key"     TEXT             NOT NULL,
    "width"     INTEGER,
    "height"    INTEGER,
    "order"     INTEGER          NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN          NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gallery_images_s3Key_key" ON "gallery_images"("s3Key");
CREATE INDEX "gallery_images_isActive_idx" ON "gallery_images"("isActive");
CREATE INDEX "gallery_images_category_idx" ON "gallery_images"("category");
