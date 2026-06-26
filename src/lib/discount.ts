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
