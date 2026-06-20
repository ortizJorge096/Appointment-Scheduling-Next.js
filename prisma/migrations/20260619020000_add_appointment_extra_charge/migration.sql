-- AddColumn: optional extra-charge breakdown on appointments
-- (used when registering past appointments with an additional charge
-- on top of the service price, e.g. "Tinte extra")
ALTER TABLE "appointments" ADD COLUMN "extraDescription" TEXT;
ALTER TABLE "appointments" ADD COLUMN "extraAmount" INTEGER;
