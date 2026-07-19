// src/lib/accounting.ts
// Shared money rules for the accounting summary (GET /api/accounting) AND its CSV
// export (GET /api/accounting/export), so the two can never disagree on what counts
// as income or as an outstanding balance. Pure functions over the minimal
// appointment shape they need — both routes select at least these fields.

export interface AppointmentMoney {
  paymentStatus: string
  amountPaid: number | null
  precioFinal: number | null
  service: { price: number }
  services: Array<{ price: number }>
}

// Gross catalog price. Multi-service appointments sum their line prices; a
// single-service booking leaves `services` empty and falls back to the one service.
export function appointmentServiceTotal(apt: Pick<AppointmentMoney, 'service' | 'services'>): number {
  if (apt.services && apt.services.length > 1) {
    return apt.services.reduce((sum, s) => sum + s.price, 0)
  }
  return apt.service.price
}

// Collected income for one appointment: nothing for a courtesy (WAIVED) or a
// rendered-but-unpaid charge (PENDING); otherwise the amount actually paid, falling
// back to the discounted snapshot (precioFinal) and then the gross price. Using
// precioFinal before the gross keeps a manual discount from inflating revenue.
export function appointmentIncome(apt: AppointmentMoney): number {
  if (apt.paymentStatus === 'WAIVED' || apt.paymentStatus === 'PENDING') return 0
  return apt.amountPaid ?? apt.precioFinal ?? appointmentServiceTotal(apt)
}

// Outstanding balance still owed: PAID/WAIVED owe nothing; PENDING owes the full
// expected value; PARTIAL owes the remainder after the recorded payment. Expected
// value is the discounted snapshot (precioFinal) when set, else the gross price.
export function appointmentBalance(apt: AppointmentMoney): number {
  if (apt.paymentStatus === 'PAID' || apt.paymentStatus === 'WAIVED') return 0
  const expected = apt.precioFinal ?? appointmentServiceTotal(apt)
  const balance  = apt.paymentStatus === 'PARTIAL' ? expected - (apt.amountPaid ?? 0) : expected
  return balance > 0 ? balance : 0
}
