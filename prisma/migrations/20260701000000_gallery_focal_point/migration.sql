-- Gallery focal point: CSS object-position for the public cover crop.
-- Existing rows default to "center center" (current behavior) → no visual change.
ALTER TABLE "gallery_images" ADD COLUMN "focalPoint" TEXT NOT NULL DEFAULT 'center center';
