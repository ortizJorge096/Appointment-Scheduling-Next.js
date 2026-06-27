-- Adicionales múltiples por cita: reemplaza las columnas escalares
-- extraDescription/extraAmount por una tabla relacionada 1:N, para poder
-- agregar más de un adicional (servicio o producto extra) por cita.

CREATE TABLE "appointment_extras" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_extras_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appointment_extras_appointmentId_idx" ON "appointment_extras"("appointmentId");

ALTER TABLE "appointment_extras" ADD CONSTRAINT "appointment_extras_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single-extra data into the new table. Each appointment
-- had at most one extra, so a deterministic "ext_<appointmentId>" id is
-- unique without needing a UUID-generation extension.
INSERT INTO "appointment_extras" ("id", "appointmentId", "description", "amount", "createdAt")
SELECT
    'ext_' || "id",
    "id",
    COALESCE("extraDescription", 'Adicional'),
    "extraAmount",
    "createdAt"
FROM "appointments"
WHERE "extraAmount" IS NOT NULL AND "extraAmount" > 0;

ALTER TABLE "appointments" DROP COLUMN "extraDescription";
ALTER TABLE "appointments" DROP COLUMN "extraAmount";
