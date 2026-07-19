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
import { formatPrice } from './utils'

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
  // Cliente / contacto
  name: 'Nombre', email: 'Email', phone: 'Teléfono', notes: 'Notas',
  clientName: 'Cliente', clientEmail: 'Email', clientPhone: 'Teléfono', deletedAt: 'Archivado',
  // Cita
  status: 'Estado', date: 'Fecha', startTime: 'Hora', endTime: 'Hora de fin',
  service: 'Servicio', serviceId: 'Servicio', professionalId: 'Profesional',
  source: 'Origen', origin: 'Origen', reason: 'Motivo',
  totalDurationMinutes: 'Duración total (min)', addedServices: 'Servicios agregados',
  extras: 'Adicionales', discountPercent: 'Descuento VIP (%)',
  // Pago / descuento
  paymentStatus: 'Estado de pago', paymentMethod: 'Método de pago', amountPaid: 'Monto pagado',
  precioFinal: 'Precio final', descuentoTipo: 'Tipo de descuento', descuentoValor: 'Descuento',
  descuentoMotivo: 'Motivo del descuento', paid: 'Pagada',
  servicesSubtotal: 'Subtotal servicios', extrasTotal: 'Total adicionales',
  discountTotal: 'Total descuento', perServiceDiscounts: 'Descuentos por servicio',
  // Gasto / catálogo
  amount: 'Monto', category: 'Categoría', categoryId: 'Categoría', description: 'Descripción',
  price: 'Precio', durationMinutes: 'Duración (min)', isActive: 'Activo', order: 'Orden',
  icon: 'Icono', enabled: 'Activo', tiers: 'Tramos', slug: 'Identificador',
  // Profesional
  specialty: 'Especialidad', reviewCount: 'N.º de reseñas', rating: 'Calificación',
  // Testimonio
  type: 'Tipo', text: 'Texto', stars: 'Estrellas', initials: 'Iniciales',
  imageUrl: 'Imagen', imageKey: 'Imagen', rejectionReason: 'Motivo de rechazo', appointmentId: 'Cita',
  // Galería / hero
  title: 'Título', focalPoint: 'Punto focal', s3Key: 'Imagen',
  // Horario
  dayOfWeek: 'Día', breakStart: 'Inicio de descanso', breakEnd: 'Fin de descanso',
  // Ajustes de reserva
  showProfessionalStep: 'Mostrar paso de profesional', maxAdvanceDays: 'Anticipación máx. (días)',
  // Métricas del sitio
  appointmentsCount: 'N.º de citas', clientsCount: 'N.º de clientes', yearsExperience: 'Años de experiencia',
  // Usuarios / acceso
  role: 'Rol', mustChangePassword: 'Forzar cambio de contraseña',
  // Metadata frecuente
  changes: 'Cambios', mode: 'Modo', rowCount: 'Filas', notifyClient: 'Notificar al cliente',
  columns: 'Columnas', filters: 'Filtros', via: 'Vía',
}

// Weekdays for schedule (Horario) audits.
const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles', THURSDAY: 'Jueves',
  FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
}

// Fields whose value is an enum → the map that translates it. `status` and
// `source` span more than one entity (appointments + testimonials), so their
// maps are merged to cover every value either can take.
const VALUE_LABELS: Record<string, Record<string, string>> = {
  status:        { ...STATUS_LABEL, DRAFT: 'Borrador', APPROVED: 'Aprobado', REJECTED: 'Rechazado' },
  paymentStatus: PAYMENT_STATUS_LABEL,
  paymentMethod: PAYMENT_METHOD_LABEL,
  source:        { ...SOURCE_LABEL, ADMIN: 'Admin', CLIENT: 'Cliente' },
  origin:        ORIGIN_LABEL,
  category:      EXPENSE_CATEGORY_LABEL,
  dayOfWeek:     DAY_LABEL,
}

const BOOL_FIELDS  = new Set(['isActive', 'enabled', 'showProfessionalStep', 'mustChangePassword', 'notifyClient', 'paid'])
const MONEY_FIELDS = new Set(['amount', 'amountPaid', 'price', 'precioFinal', 'servicesSubtotal', 'extrasTotal', 'discountTotal'])

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
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return formatPrice(value)
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
