-- Token de cancelación para citas (enlace seguro en el email)

-- 1. Columna nullable temporalmente
ALTER TABLE "appointments" ADD COLUMN "cancelToken" TEXT;

-- 2. Backfill de filas existentes con un valor único
UPDATE "appointments"
SET "cancelToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "cancelToken" IS NULL;

-- 3. Forzar NOT NULL una vez backfilleado
ALTER TABLE "appointments" ALTER COLUMN "cancelToken" SET NOT NULL;

-- 4. Índice único
CREATE UNIQUE INDEX "appointments_cancelToken_key" ON "appointments"("cancelToken");
