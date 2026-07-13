// src/lib/auditFormat.ts
// Turns raw audit-log rows (canonical English field keys + enum values) into
// human-readable Spanish, for BOTH the admin view and the CSV export.
//
// Display-time only: the stored before/after stays canonical, so historical rows
// (already written with English keys) render correctly with the same helper — no
// migration, no touching the ~20 audit() call sites.

import {
  STATUS_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL,
  SOURCE_LABEL, ORIGIN_LABEL, EXPENSE_CATEGORY_LABEL,
} from './labels'

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'CANCEL'
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'EMAIL_SENT' | 'EMAIL_FAILED' | 'EXPORT'
export type AuditEntity =
  | 'APPOINTMENT' | 'CLIENT' | 'EXPENSE' | 'SERVICE' | 'CATEGORY' | 'GALLERY'
  | 'SCHEDULE' | 'PROFESSIONAL' | 'TESTIMONIAL' | 'AUTH' | 'EMAIL'
export type AuditActor = 'ADMIN' | 'CLIENT' | 'SYSTEM'

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Creación', UPDATE: 'Edición', DELETE: 'Eliminación', STATUS_CHANGE: 'Cambio de estado',
  CANCEL: 'Cancelación', LOGIN: 'Inicio de sesión', LOGIN_FAILED: 'Login fallido',
  LOGOUT: 'Cierre de sesión', EMAIL_SENT: 'Email enviado', EMAIL_FAILED: 'Email fallido', EXPORT: 'Exportación',
}

export const ENTITY_LABELS: Record<AuditEntity, string> = {
  APPOINTMENT: 'Cita', CLIENT: 'Cliente', EXPENSE: 'Gasto', SERVICE: 'Servicio', CATEGORY: 'Categoría',
  GALLERY: 'Galería', SCHEDULE: 'Horario', PROFESSIONAL: 'Profesional', TESTIMONIAL: 'Testimonio', AUTH: 'Acceso', EMAIL: 'Email',
}

export const ACTOR_LABELS: Record<AuditActor, string> = { ADMIN: 'Admin', CLIENT: 'Cliente', SYSTEM: 'Sistema' }

// Friendly emoji keyed by action (the "what happened") — always defined, unlike
// the compound event names people expect. Entity stays visible as a text label.
export const ACTION_EMOJI: Record<AuditAction, string> = {
  CREATE: '➕', UPDATE: '✏️', DELETE: '🗑️', STATUS_CHANGE: '🔄', CANCEL: '❌',
  LOGIN: '🔐', LOGIN_FAILED: '⚠️', LOGOUT: '🚪', EMAIL_SENT: '📧', EMAIL_FAILED: '📛', EXPORT: '📤',
}

// Canonical field key → Spanish label. Unknown keys fall back to the raw key
// (never crash on a field we haven't mapped yet).
export const FIELD_LABELS: Record<string, string> = {
  // Cliente
  name: 'Nombre', email: 'Email', phone: 'Teléfono', notes: 'Notas',
  // Cita
  status: 'Estado', date: 'Fecha', startTime: 'Hora', endTime: 'Hora de fin',
  clientName: 'Cliente', service: 'Servicio', source: 'Origen', origin: 'Origen',
  // Pago / descuento
  paymentStatus: 'Estado de pago', paymentMethod: 'Método de pago', amountPaid: 'Monto pagado',
  precioFinal: 'Precio final', descuentoTipo: 'Tipo de descuento', descuentoValor: 'Descuento',
  descuentoMotivo: 'Motivo del descuento',
  // Gasto
  amount: 'Monto', category: 'Categoría', description: 'Descripción',
  // Servicio / catálogo
  price: 'Precio', durationMinutes: 'Duración (min)', isActive: 'Activo', order: 'Orden',
  icon: 'Icono', enabled: 'Activo', tiers: 'Tramos',
  // Métricas del sitio
  appointmentsCount: 'N.º de citas', clientsCount: 'N.º de clientes',
  yearsExperience: 'Años de experiencia', rating: 'Calificación',
  // Admins / metadata frecuente
  role: 'Rol', changes: 'Cambios', mode: 'Modo', rowCount: 'Filas',
}

// Fields whose value is an enum → the map that translates it.
const VALUE_LABELS: Record<string, Record<string, string>> = {
  status:        STATUS_LABEL,
  paymentStatus: PAYMENT_STATUS_LABEL,
  paymentMethod: PAYMENT_METHOD_LABEL,
  source:        SOURCE_LABEL,
  origin:        ORIGIN_LABEL,
  category:      EXPENSE_CATEGORY_LABEL,
}

const BOOL_FIELDS  = new Set(['isActive', 'enabled'])
const MONEY_FIELDS = new Set(['amount', 'amountPaid', 'price', 'precioFinal'])

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

/** Spanish label for a field key (falls back to the raw key). */
export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

/**
 * Renders a single value in Spanish: enums via VALUE_LABELS, booleans as Sí/No,
 * money fields as COP, null/empty as an em dash, objects as compact JSON.
 * Never throws.
 */
export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (BOOL_FIELDS.has(key) || typeof value === 'boolean') {
    return value === true || value === 'true' ? 'Sí' : 'No'
  }
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return COP(value)
  const map = VALUE_LABELS[key]
  if (map && typeof value === 'string' && map[value]) return map[value]
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

export interface DiffEntry {
  label: string
  kind:  'changed' | 'set' | 'removed'
  text:  string
}

/**
 * Merges before/after into a readable, Spanish diff. Omits unchanged fields and
 * fields that are empty on both sides. `action` shapes phrasing for the one-sided
 * case: CREATE → "set" (added), DELETE → "removed".
 */
export function formatDiff(
  before: Record<string, unknown> | null | undefined,
  after:  Record<string, unknown> | null | undefined,
  action?: string,
): DiffEntry[] {
  const b = before ?? {}
  const a = after ?? {}
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
  const out: DiffEntry[] = []

  const empty = (v: unknown) => v === null || v === undefined || v === ''

  for (const key of keys) {
    const prev = b[key]
    const next = a[key]
    const hasPrev = key in b
    const hasNext = key in a

    if (hasPrev && hasNext && prev === next) continue      // unchanged
    if (empty(prev) && empty(next)) continue               // empty on both sides

    const label = fieldLabel(key)

    if (hasPrev && hasNext) {
      out.push({ label, kind: 'changed', text: `${formatValue(key, prev)} → ${formatValue(key, next)}` })
    } else if (hasNext) {
      out.push({ label, kind: action === 'DELETE' ? 'removed' : 'set', text: formatValue(key, next) })
    } else {
      out.push({ label, kind: 'removed', text: formatValue(key, prev) })
    }
  }
  return out
}

/** One-line text form of the diff, for the CSV export. */
export function formatDiffText(
  before: Record<string, unknown> | null | undefined,
  after:  Record<string, unknown> | null | undefined,
  action?: string,
): string {
  return formatDiff(before, after, action)
    .map((d) => `${d.label}: ${d.text}${d.kind === 'removed' ? ' (eliminado)' : ''}`)
    .join(' · ')
}
