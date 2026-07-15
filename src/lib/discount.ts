// src/lib/discount.ts
// Pure manual-discount math, shared by the API (authoritative) and the admin
// UI (live preview) so they never diverge. All amounts are integer COP.

export type DiscountKind = 'PORCENTAJE' | 'VALOR_FIJO'

/**
 * Discount amount in COP for a given subtotal. Percentage is rounded to the
 * nearest peso; the result is clamped to [0, subtotal] so it can never exceed
 * the bill or go negative.
 */
export function computeDiscountAmount(
  subtotal: number,
  tipo: DiscountKind | null | undefined,
  valor: number | null | undefined,
): number {
  if (!tipo || valor == null || valor <= 0 || subtotal <= 0) return 0
  const raw = tipo === 'PORCENTAJE' ? Math.round((subtotal * valor) / 100) : valor
  return Math.min(Math.max(0, raw), subtotal)
}

/** Final price (subtotal − discount), never below 0. */
export function computeFinalPrice(
  subtotal: number,
  tipo: DiscountKind | null | undefined,
  valor: number | null | undefined,
): number {
  return subtotal - computeDiscountAmount(subtotal, tipo, valor)
}

export interface AppointmentLineForTotal {
  price: number
  descuentoTipo?: DiscountKind | null
  descuentoValor?: number | null
  extras?: number[] // per-line extra amounts (COP)
}

/**
 * Full money breakdown for an appointment. Discounts are EITHER per service line
 * OR a single order-level total — never both (the UI and API enforce this).
 * Extras always add. All integer COP; the total is clamped to ≥ 0.
 */
export function computeAppointmentTotal(
  lines: AppointmentLineForTotal[],
  generalExtras: number[] = [],
  order?: { tipo?: DiscountKind | null; valor?: number | null },
): { servicesSubtotal: number; extrasTotal: number; discount: number; total: number } {
  const servicesSubtotal = lines.reduce((s, l) => s + l.price, 0)
  const lineExtras = lines.reduce((s, l) => s + (l.extras ?? []).reduce((a, b) => a + b, 0), 0)
  const extrasTotal = lineExtras + generalExtras.reduce((a, b) => a + b, 0)

  const orderValor = order?.valor ?? 0
  if (order?.tipo && orderValor > 0) {
    // Order-level (total) discount over services + extras.
    const base = servicesSubtotal + extrasTotal
    const discount = computeDiscountAmount(base, order.tipo, orderValor)
    return { servicesSubtotal, extrasTotal, discount, total: Math.max(0, base - discount) }
  }

  // Per-line discounts (or none). The discount covers the WHOLE line — the
  // service price plus that line's own extras — so a discounted service with an
  // add-on discounts the add-on too (consistent with the order-level branch).
  const lineDiscount = lines.reduce((s, l) => {
    const lineBase = l.price + (l.extras ?? []).reduce((a, b) => a + b, 0)
    return s + computeDiscountAmount(lineBase, l.descuentoTipo, l.descuentoValor)
  }, 0)
  return {
    servicesSubtotal,
    extrasTotal,
    discount: lineDiscount,
    total: Math.max(0, servicesSubtotal + extrasTotal - lineDiscount),
  }
}
