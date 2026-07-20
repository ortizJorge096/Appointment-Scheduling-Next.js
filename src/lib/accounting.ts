// src/lib/accounting.ts
// Shared money rules for the accounting summary (GET /api/accounting), its CSV
// export, the dashboard and the appointment lists, so they can never disagree on
// what an appointment charges, what it collected, or what it still owes.
//
// The charge is NOT a plain sum of catalog prices: discounts (per service line OR
// order-level, never both) and extras (which ADD) all move it. That math lives in
// src/lib/discount — this module just feeds it the right shape.

import { computeAppointmentTotal, type DiscountKind } from './discount'

export interface AppointmentMoney {
  paymentStatus: string
  amountPaid: number | null
  /** Snapshot of the charge taken when a discount was applied. Authoritative when set. */
  precioFinal: number | null
  /** Order-level manual discount (mutually exclusive with per-line discounts). */
  descuentoTipo: DiscountKind | null
  descuentoValor: number | null
  /**
   * ALL of the appointment's extras. Every extra carries `appointmentId`, and the
   * ones attached to a service line ALSO carry `appointmentServiceId` — those are
   * already counted inside their line, so this module filters them out here. Select
   * `appointmentServiceId` or line extras get double-counted.
   */
  extras: Array<{ amount: number; appointmentServiceId: string | null }>
  /** Legacy single-service appointments have no AppointmentService rows. */
  service: { price: number }
  services: Array<{
    price: number
    descuentoTipo: DiscountKind | null
    descuentoValor: number | null
    extras: Array<{ amount: number }>
  }>
}

/**
 * Sum of service prices (before extras and discounts):
 *   - Multi-service → sum of `services[].price`
 *   - Legacy single-service fallback → `service.price`
 */
export function appointmentServiceTotal(apt: AppointmentMoney): number {
  return apt.services && apt.services.length > 0
    ? apt.services.reduce((sum, s) => sum + s.price, 0)
    : apt.service.price
}

/**
 * What the appointment charges: services + extras − discounts. Uses the same
 * `computeAppointmentTotal` the booking/edit APIs use to write `precioFinal`, so a
 * recomputation always agrees with the snapshot (line prices are snapshots too).
 */
export function appointmentCharge(apt: AppointmentMoney): number {
  const lines = apt.services && apt.services.length > 0
    ? apt.services.map((s) => ({
        price:          s.price,
        descuentoTipo:  s.descuentoTipo,
        descuentoValor: s.descuentoValor,
        extras:         (s.extras ?? []).map((e) => e.amount),
      }))
    // Legacy single-service appointment without AppointmentService rows: one line,
    // no per-line discount possible.
    : [{ price: apt.service.price, descuentoTipo: null, descuentoValor: null, extras: [] as number[] }]

  // Only the appointment-level ("general") extras — line extras are already inside
  // their line above, so counting them here too would double them.
  const generalExtras = (apt.extras ?? [])
    .filter((e) => !e.appointmentServiceId)
    .map((e) => e.amount)

  return computeAppointmentTotal(lines, generalExtras, {
    tipo:  apt.descuentoTipo,
    valor: apt.descuentoValor,
  }).total
}

/**
 * Collected income for one appointment: nothing for a courtesy (WAIVED) or a
 * rendered-but-unpaid charge (PENDING); otherwise the amount actually paid, falling
 * back to the discounted snapshot (precioFinal) and then to the computed charge.
 */
export function appointmentIncome(apt: AppointmentMoney): number {
  if (apt.paymentStatus === 'WAIVED' || apt.paymentStatus === 'PENDING') return 0
  return apt.amountPaid ?? apt.precioFinal ?? appointmentCharge(apt)
}

/**
 * Outstanding balance still owed: PAID/WAIVED owe nothing; PENDING owes the full
 * charge; PARTIAL owes the remainder after the recorded payment.
 */
export function appointmentBalance(apt: AppointmentMoney): number {
  if (apt.paymentStatus === 'PAID' || apt.paymentStatus === 'WAIVED') return 0
  const expected = apt.precioFinal ?? appointmentCharge(apt)
  const balance  = apt.paymentStatus === 'PARTIAL' ? expected - (apt.amountPaid ?? 0) : expected
  return balance > 0 ? balance : 0
}
