-- Per-service discount (on appointment_services) + optional per-service link for
-- extras (on appointment_extras). Existing rows keep NULLs → behave exactly as
-- before (discounts/extras stay at the appointment/general level).

ALTER TABLE "appointment_services"
  ADD COLUMN "descuentoTipo"   "DiscountType",
  ADD COLUMN "descuentoValor"  INTEGER,
  ADD COLUMN "descuentoMotivo" TEXT;

ALTER TABLE "appointment_extras"
  ADD COLUMN "appointmentServiceId" TEXT;

ALTER TABLE "appointment_extras"
  ADD CONSTRAINT "appointment_extras_appointmentServiceId_fkey"
  FOREIGN KEY ("appointmentServiceId") REFERENCES "appointment_services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "appointment_extras_appointmentServiceId_idx"
  ON "appointment_extras"("appointmentServiceId");
