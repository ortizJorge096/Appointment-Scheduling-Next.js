// src/lib/validations.ts
// Zod validation schemas — valentinajimenez

import { z } from 'zod'
import { ICON_KEYS } from '@/lib/config'

const iconEnum = z.enum(ICON_KEYS as unknown as [string, ...string[]])

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// Validates HH:MM format (e.g.: "09:00", "18:30")
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
const timeString = z.string().regex(timeRegex, 'Formato de hora inválido. Use HH:MM')

// Validates YYYY-MM-DD format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const dateString = z.string().regex(dateRegex, 'Formato de fecha inválido. Use YYYY-MM-DD')

// Optional email: an empty string (the form sends "" when left blank) becomes
// undefined, so a blank field passes; if anything is typed it must be valid.
const optionalEmail = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().email('Email inválido').optional(),
)

// Phone: validated by DIGIT count, not raw character length, so formatting
// (spaces, dashes, parentheses, leading +) doesn't change the result. Requires
// at least 10 digits — a Colombian mobile — so incomplete numbers can't be
// saved; up to 15 covers numbers that already include a country code. Stays in
// sync with toWhatsAppNumber() so a saved phone always yields a WhatsApp link.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\s()-]+$/, 'Teléfono inválido')
  .refine((v) => {
    const digits = v.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  }, 'El teléfono debe tener al menos 10 dígitos (incluye el código de país si aplica)')

// Manual discount (admin only). Shape is validated here; the subtotal-bound rule
// (VALOR_FIJO ≤ subtotal) is enforced in the route, where the subtotal is known.
// Nullable so the admin can CLEAR a saved discount (send the fields as null).
const discountFields = {
  descuentoTipo:   z.enum(['PORCENTAJE', 'VALOR_FIJO']).nullable().optional(),
  descuentoValor:  z.number().int().min(0, 'El descuento no puede ser negativo').nullable().optional(),
  descuentoMotivo: z.string().max(200).nullable().optional(),
}

// Adicionales (servicio o producto extra agregado a la cita). Lista completa:
// al guardar se reemplaza el set de adicionales de la cita por este array.
const extrasSchema = z.array(z.object({
  description: z.string().min(1, 'La descripción del adicional es requerida').max(200),
  amount:      z.number().int().min(0, 'El monto no puede ser negativo'),
})).max(20).optional()

// Cross-field discount checks, shared by the manual-create and update schemas.
// null/undefined both mean "not set" (clearing is all-null, which passes).
function checkDiscount(
  data: { descuentoTipo?: string | null; descuentoValor?: number | null },
  ctx: z.RefinementCtx,
): void {
  const { descuentoTipo, descuentoValor } = data
  const hasTipo  = descuentoTipo != null
  const hasValor = descuentoValor != null
  if (hasTipo && !hasValor)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['descuentoValor'], message: 'Indica el valor del descuento' })
  if (hasValor && !hasTipo)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['descuentoTipo'], message: 'Indica el tipo de descuento' })
  if (descuentoTipo === 'PORCENTAJE' && (descuentoValor ?? 0) > 100)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['descuentoValor'], message: 'El porcentaje no puede superar 100' })
}

// ─────────────────────────────────────────
// BOOKING (public)
// ─────────────────────────────────────────

export const createAppointmentSchema = z.object({
  clientName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),

  clientEmail: optionalEmail,

  clientPhone: phoneSchema,

  serviceId: z
    .string()
    .cuid('ID de servicio inválido'),

  serviceIds: z
    .array(z.string().cuid('ID de servicio inválido'))
    .min(1, 'Selecciona al menos un servicio')
    .max(5, 'Máximo 5 servicios por cita')
    .optional(),

  totalDurationMinutes: z
    .number()
    .int()
    .min(15, 'Duración mínima 15 minutos')
    .max(480, 'Duración máxima 8 horas')
    .optional(),

  // Omitido o null = "Primera disponible" (el servidor asigna el primer profesional libre)
  professionalId: z
    .string()
    .cuid('ID de profesional inválido')
    .nullable()
    .optional(),

  date: dateString,

  startTime: timeString,

  notes: z
    .string()
    .max(500, 'Las notas no pueden superar 500 caracteres')
    .optional(),
}).refine(
  (data) => {
    if (data.serviceIds && data.serviceIds.length > 1) {
      return data.totalDurationMinutes !== undefined && data.totalDurationMinutes > 0
    }
    return true
  },
  { message: 'totalDurationMinutes es requerido para citas con múltiples servicios' }
)

export type CreateAppointmentSchema = z.infer<typeof createAppointmentSchema>

// ─────────────────────────────────────────
// AVAILABILITY (query params)
// ─────────────────────────────────────────

export const availabilityQuerySchema = z.object({
  date: dateString,
  serviceId: z.string().cuid('ID de servicio inválido').optional(),
  durationMinutes: z.coerce.number().int().min(15).max(480).optional(),
  professionalId: z.string().cuid('ID de profesional inválido').optional(),
}).refine(
  (data) => data.serviceId || data.durationMinutes,
  { message: 'Se requiere serviceId o durationMinutes' }
)

// ─────────────────────────────────────────
// UPDATE APPOINTMENT (admin)
// ─────────────────────────────────────────

export const updateAppointmentSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .optional(),

  paymentStatus: z
    .enum(['PENDING', 'PAID', 'PARTIAL', 'WAIVED'])
    .optional(),

  paymentMethod: z
    .enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'NEQUI', 'DAVIPLATA'])
    .nullable()
    .optional(),

  amountPaid: z.number().int().min(0).nullable().optional(),

  notes: z.string().max(500).optional(),

  date: dateString.optional(),

  startTime: timeString.optional(),

  // Manual discount (applied from the detail payment block).
  ...discountFields,

  // Adicionales (replaces the full set when provided).
  extras: extrasSchema,
}).superRefine(checkDiscount)

// ─────────────────────────────────────────
// CATEGORIES (admin)
// ─────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'El nombre es demasiado largo'),

  description: z
    .string()
    .max(300)
    .optional(),

  icon: iconEnum.optional(),

  order: z.number().int().min(0).optional(),
})

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ─────────────────────────────────────────
// SERVICES (admin)
// ─────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80),

  description: z
    .string()
    .max(300)
    .optional(),

  categoryId: z
    .string()
    .cuid('Selecciona una categoría válida'),

  price: z
    .number()
    .int('El precio debe ser un número entero')
    .positive('El precio debe ser mayor a 0')
    .max(10_000_000, 'Precio demasiado alto'),

  durationMinutes: z
    .number()
    .int()
    .min(15, 'La duración mínima es 15 minutos')
    .max(480, 'La duración máxima es 8 horas'),

  order: z.number().int().min(0).optional(),
})

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ─────────────────────────────────────────
// SCHEDULES (admin)
// ─────────────────────────────────────────

// Optional time: '' or undefined → null; otherwise must be HH:MM.
const optionalTime = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().regex(timeRegex, 'Formato de hora inválido. Use HH:MM').nullable(),
)

export const scheduleSchema = z.object({
  dayOfWeek: z.enum([
    'MONDAY', 'TUESDAY', 'WEDNESDAY',
    'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  ]),
  startTime: timeString,
  endTime: timeString,
  breakStart: optionalTime,
  breakEnd:   optionalTime,
  isActive: z.boolean(),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: 'La hora de inicio debe ser anterior a la hora de fin' }
).refine(
  (d) => (d.breakStart == null) === (d.breakEnd == null),
  { message: 'El descanso necesita hora de inicio y de fin', path: ['breakEnd'] }
).refine(
  (d) => d.breakStart == null || d.breakEnd == null ||
    (d.breakStart < d.breakEnd && d.breakStart >= d.startTime && d.breakEnd <= d.endTime),
  { message: 'El descanso debe estar dentro del horario de atención', path: ['breakStart'] }
)

// ─────────────────────────────────────────
// BLOCKED DATES (admin)
// ─────────────────────────────────────────

export const blockedDateSchema = z.object({
  date: dateString,
  reason: z.string().max(200).optional(),
})

// ─────────────────────────────────────────
// GALLERY (admin)
// ─────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const galleryUploadUrlSchema = z.object({
  filename:    z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    errorMap: () => ({ message: 'Solo JPG, PNG o WebP' }),
  }),
})

export const galleryCreateSchema = z.object({
  s3Key:       z.string().min(1).max(300),
  title:       z.string().max(120).optional(),
  description: z.string().max(300).optional(),
  categoryId:  z.string().cuid('Categoría inválida').nullable().optional(),
  width:       z.number().int().positive().optional(),
  height:      z.number().int().positive().optional(),
})

export const galleryUpdateSchema = z.object({
  s3Key:       z.string().min(1).max(300).optional(),
  title:       z.string().max(120).nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  categoryId:  z.string().cuid('Categoría inválida').nullable().optional(),
  order:       z.number().int().min(0).optional(),
  isActive:    z.boolean().optional(),
})

// ─────────────────────────────────────────
// TESTIMONIALS (admin)
// ─────────────────────────────────────────

export const createTestimonialSchema = z.object({
  clientName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  type:       z.string().min(2, 'El tipo es requerido').max(60),
  text:       z.string().min(5, 'El testimonio es muy corto').max(200, 'Máximo 200 caracteres'),
  stars:      z.number().int().min(1).max(5).optional(),
  imageUrl:   z.string().url('URL de imagen inválida').nullable().optional(),
  imageKey:   z.string().max(300).nullable().optional(),
  order:      z.number().int().min(0).optional(),
  clientEmail: optionalEmail,
})

export const updateTestimonialSchema = createTestimonialSchema.partial().extend({
  isActive:        z.boolean().optional(),
  status:          z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
  rejectionReason: z.string().max(300).nullable().optional(),
})

// ─────────────────────────────────────────
// LOGIN (admin)
// ─────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

// ─────────────────────────────────────────
// UPDATE APPOINTMENT PAYMENT (admin)
// ─────────────────────────────────────────

export const updateAppointmentPaymentSchema = updateAppointmentSchema

// ─────────────────────────────────────────
// MANUAL APPOINTMENT (admin)
// ─────────────────────────────────────────

export const createManualAppointmentSchema = z.object({
  clientName:  z.string().min(2).max(100),
  clientEmail: optionalEmail,
  clientPhone: phoneSchema,
  // When an existing client was picked in the modal: its id, so we reuse and
  // enrich that exact profile (e.g. save a phone it was missing) instead of
  // re-resolving identity and risking a duplicate.
  clientId:    z.string().cuid('ID de cliente inválido').optional(),
  serviceId:   z.string().cuid('ID de servicio inválido'),
  // Optional multi-service: when 2+ are sent, serviceId stays the primary and
  // the appointment gets one AppointmentService row per service.
  serviceIds:  z.array(z.string().cuid('ID de servicio inválido')).min(1).max(5).optional(),
  date:        dateString,
  startTime:   timeString,
  source:      z.enum(['ONLINE','WHATSAPP','TELEFONO','PRESENCIAL']).default('PRESENCIAL'),
  notes:       z.string().max(500).optional(),
  skipAvailabilityCheck: z.boolean().optional().default(false),

  // Sends the regular client-facing confirmation email (only applies to
  // mode: 'UPCOMING' — a "Cita pasada" never gets a "your appointment is
  // confirmed" email since it's already completed).
  notifyClient: z.boolean().optional().default(false),

  // "Cita pasada": registers an already-rendered appointment directly as
  // completed and paid. Defaults to the existing ("Cita próxima") behavior.
  mode:             z.enum(['UPCOMING', 'PAST']).optional().default('UPCOMING'),
  totalCharged:     z.number().int().min(0).optional(),
  extras:           extrasSchema,

  // Manual discount on a past appointment's charge.
  ...discountFields,
}).refine(
  (data) => data.mode !== 'PAST' || data.totalCharged !== undefined,
  { message: 'El total cobrado es requerido para registrar una cita pasada', path: ['totalCharged'] }
).superRefine(checkDiscount)

// ─────────────────────────────────────────
// CLIENTS (admin)
// ─────────────────────────────────────────

export const createClientSchema = z.object({
  name:  z.string().min(2).max(100),
  email: optionalEmail,
  phone: z.string().min(7).max(15).regex(/^[0-9+\s-]+$/, 'Teléfono inválido').optional(),
  notes: z.string().max(1000).optional(),
})

export const updateClientSchema = createClientSchema.partial()

// ─────────────────────────────────────────
// EXPENSES (admin)
// ─────────────────────────────────────────

export const createExpenseSchema = z.object({
  description: z.string().min(2).max(200),
  amount:      z.number().int().positive('El monto debe ser mayor a 0'),
  date:        dateString,
  category:    z.enum(['INSUMOS','EQUIPOS','SERVICIOS','ARRIENDO','MARKETING','OTROS']).optional(),
  notes:       z.string().max(500).optional(),
})

export const updateExpenseSchema = createExpenseSchema.partial()

// ─────────────────────────────────────────
// PROFESSIONALS (admin)
// ─────────────────────────────────────────

export const createProfessionalSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  specialty: z.string().max(120).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
})

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ─────────────────────────────────────────
// VIP DISCOUNT CONFIG (admin)
// ─────────────────────────────────────────

export const vipConfigSchema = z.object({
  enabled: z.boolean(),
  tiers: z
    .array(z.object({
      minServices: z.number().int().min(2, 'El tramo mínimo es 2 servicios').max(20),
      discountPct: z.number().int().min(0).max(100),
    }))
    .min(1, 'Debe haber al menos un tramo de descuento'),
})

// ─────────────────────────────────────────
// BOOKING SETTINGS (admin)
// ─────────────────────────────────────────

export const bookingSettingsSchema = z.object({
  showProfessionalStep: z.boolean().optional(),
  maxAdvanceDays: z
    .number()
    .int()
    .min(7, 'El mínimo es 7 días')
    .max(365, 'El máximo es 365 días')
    .optional(),
}).refine(
  (d) => d.showProfessionalStep !== undefined || d.maxAdvanceDays !== undefined,
  { message: 'No hay nada que actualizar' }
)

// ─────────────────────────────────────────
// LANDING STATS (admin)
// ─────────────────────────────────────────

export const landingStatsSchema = z.object({
  appointmentsCount: z.number().int().min(0, 'No puede ser negativo').max(1_000_000),
  clientsCount:      z.number().int().min(0, 'No puede ser negativo').max(1_000_000),
  yearsExperience:   z.number().int().min(0, 'No puede ser negativo').max(100),
  rating:            z.number().min(0).max(5, 'La calificación máxima es 5'),
})

// ─────────────────────────────────────────
// ADMINS / AUTH (admin)
// ─────────────────────────────────────────

// Password policy: at least 8 chars, one uppercase, one digit.
const strongPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número')

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword:     strongPassword,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden', path: ['confirmPassword'],
}).refine((d) => d.newPassword !== d.currentPassword, {
  message: 'La nueva contraseña debe ser distinta de la actual', path: ['newPassword'],
})

export const createUserSchema = z.object({
  name:     z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  email:    z.string().email('Email inválido'),
  password: strongPassword,
  role:     z.enum(['ADMIN', 'SUPER_ADMIN']).default('ADMIN'),
})

export const updateUserSchema = z.object({
  name:        z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80).optional(),
  email:       z.string().email('Email inválido').optional(),
  role:        z.enum(['ADMIN', 'SUPER_ADMIN']).optional(),
  isActive:    z.boolean().optional(),
  // Optional admin-driven password reset (sets a new password for the target).
  newPassword: strongPassword.optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'No hay nada que actualizar',
})
