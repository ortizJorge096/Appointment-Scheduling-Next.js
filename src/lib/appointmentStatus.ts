// src/lib/appointmentStatus.ts
// Single source of truth for how appointment statuses are labeled and
// colored across the admin. Before this, each page redefined its own copy —
// clientes/[id] once drifted to completely different colors than /admin/citas
// for the same five statuses. Import from here instead of redefining locally.

export const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW:   'No asistió',
}

// Matches the .badge-* classes defined in globals.css
export const STATUS_CLASS: Record<string, string> = {
  PENDING:   'badge-pending',
  CONFIRMED: 'badge-confirmed',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
  NO_SHOW:   'badge-no_show',
}
