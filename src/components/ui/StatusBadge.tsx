// src/components/ui/StatusBadge.tsx
// Shared status pills/labels. The label + class maps already live in
// appointmentStatus.ts and labels.ts; these components just stop every call site
// from re-writing the same <span className={CLASS[x]}>{LABEL[x]}</span>.

import { STATUS_LABEL, STATUS_CLASS } from '@/lib/appointmentStatus'
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_CLASS } from '@/lib/labels'

/** Appointment status as a colored pill (badge-* classes from globals.css). */
export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span className={`${STATUS_CLASS[status] ?? 'badge-pending'} ${className}`.trim()}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/** Payment status as colored text (matches the current inline rendering). */
export function PaymentBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span className={`font-medium ${PAYMENT_STATUS_CLASS[status] ?? 'text-ink-muted-deep'} ${className}`.trim()}>
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </span>
  )
}
