-- ─────────────────────────────────────────────────────────────
-- MANUAL DISCOUNT ON APPOINTMENTS
-- Admin-only discount for manual appointments (% or fixed COP). Independent
-- from the public-flow VIP discountPercent. precioFinal = subtotal − descuento.
-- All columns nullable: existing rows have no manual discount.
-- ─────────────────────────────────────────────────────────────

CREATE TYPE "DiscountType" AS ENUM ('PORCENTAJE', 'VALOR_FIJO');

ALTER TABLE "appointments" ADD COLUMN "descuentoTipo"   "DiscountType";
ALTER TABLE "appointments" ADD COLUMN "descuentoValor"  INTEGER;
ALTER TABLE "appointments" ADD COLUMN "descuentoMotivo" TEXT;
ALTER TABLE "appointments" ADD COLUMN "precioFinal"     INTEGER;
