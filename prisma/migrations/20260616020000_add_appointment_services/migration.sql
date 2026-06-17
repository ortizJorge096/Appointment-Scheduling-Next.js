-- CreateTable
CREATE TABLE "appointment_services" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_services_appointmentId_serviceId_key" ON "appointment_services"("appointmentId", "serviceId");

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddColumn
ALTER TABLE "appointments" ADD COLUMN "totalDurationMinutes" INTEGER NOT NULL DEFAULT 0;

-- MigrateData: populate totalDurationMinutes and appointment_services for existing appointments
INSERT INTO "appointment_services" ("id", "appointmentId", "serviceId", "price")
SELECT
    gen_random_uuid()::text,
    a."id",
    a."serviceId",
    s."price"
FROM "appointments" a
JOIN "services" s ON s."id" = a."serviceId"
WHERE a."totalDurationMinutes" = 0;

UPDATE "appointments" a
SET "totalDurationMinutes" = s."durationMinutes"
FROM "services" s
WHERE s."id" = a."serviceId" AND a."totalDurationMinutes" = 0;
