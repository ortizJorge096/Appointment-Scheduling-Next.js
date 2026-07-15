// src/lib/labels.ts
// Single source of truth for human-readable Spanish labels of enum values,
// shared across the admin (audit view + CSV export, accounting, client history…).
// Before this, PAYMENT/METHOD labels were duplicated per page and drifted.

import { STATUS_LABEL } from './appointmentStatus'

// Re-exported so callers have one import point for value labels.
export { STATUS_LABEL }

// Appointment.paymentStatus
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Sin pago', PAID: 'Pagado', PARTIAL: 'Parcial', WAIVED: 'Cortesía',
}

// Text color per payment status (for the <PaymentBadge> / inline labels).
export const PAYMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: 'text-orange-600', PAID: 'text-green-600', PARTIAL: 'text-blue-600', WAIVED: 'text-purple-600',
}

// Appointment.paymentMethod — the enum values are already Spanish; this only
// prettifies the casing and covers the synthetic 'SIN_REGISTRAR' bucket used by
// the accounting breakdown.
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta',
  NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', SIN_REGISTRAR: 'Sin registrar',
}

// Appointment.source — how the booking reached us.
export const SOURCE_LABEL: Record<string, string> = {
  ONLINE: 'Web', WHATSAPP: 'WhatsApp', TELEFONO: 'Teléfono', PRESENCIAL: 'Presencial',
}

// Appointment.origin — internal booking origin.
export const ORIGIN_LABEL: Record<string, string> = {
  PUBLIC: 'Web pública', VIP: 'Paquete VIP', MANUAL: 'Manual (admin)', PAST: 'Cita pasada',
}

// Expense.category — already Spanish; prettify casing.
export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  INSUMOS: 'Insumos', EQUIPOS: 'Equipos', SERVICIOS: 'Servicios',
  ARRIENDO: 'Arriendo', MARKETING: 'Marketing', OTROS: 'Otros',
}
