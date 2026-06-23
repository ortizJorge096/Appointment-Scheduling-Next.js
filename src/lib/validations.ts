// src/lib/validations.ts
// Zod validation schemas — valentinajimenez

import { z } from 'zod'

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// Validates HH:MM format (e.g.: "09:00", "18:30")
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
const timeString = z.string().regex(timeRegex, 'Formato de hora inválido. Use HH:MM')

// Validates YYYY-MM-DD format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const dateString = z.string().regex(dateRegex, 'Formato de fecha inválido. Use YYYY-MM-DD')

// ─────────────────────────────────────────
// BOOKING (public)
// ─────────────────────────────────────────

export const createAppointmentSchema = z.object({
  clientName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),

  clientEmail: z
    .string()
    .email('Email inválido'),

  clientPhone: z
    .string()
    .min(7, 'Teléfono inválido')
    .max(15, 'Teléfono inválido')
    .regex(/^[0-9+\s-]+$/, 'Teléfono inválido'),

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

  category: z
    .enum(['UNAS', 'PESTANAS', 'CEJAS', 'CORTE', 'PROMOS'])
    .optional(),

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

export const scheduleSchema = z.object({
  dayOfWeek: z.enum([
    'MONDAY', 'TUESDAY', 'WEDNESDAY',
    'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  ]),
  startTime: timeString,
  endTime: timeString,
  isActive: z.boolean(),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: 'La hora de inicio debe ser anterior a la hora de fin' }
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
  category:    z.enum(['UNAS', 'PESTANAS', 'CEJAS', 'CORTE', 'PROMOS']).optional(),
  width:       z.number().int().positive().optional(),
  height:      z.number().int().positive().optional(),
})

export const galleryUpdateSchema = z.object({
  s3Key:       z.string().min(1).max(300).optional(),
  title:       z.string().max(120).nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  category:    z.enum(['UNAS', 'PESTANAS', 'CEJAS', 'CORTE', 'PROMOS']).nullable().optional(),
  order:       z.number().int().min(0).optional(),
  isActive:    z.boolean().optional(),
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
  clientEmail: z.string().email('Email inválido'),
  clientPhone: z.string().min(7).max(15).regex(/^[0-9+\s-]+$/, 'Teléfono inválido'),
  serviceId:   z.string().cuid('ID de servicio inválido'),
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
  extraDescription: z.string().max(200).optional(),
  extraAmount:      z.number().int().min(0).optional(),
}).refine(
  (data) => data.mode !== 'PAST' || data.totalCharged !== undefined,
  { message: 'El total cobrado es requerido para registrar una cita pasada', path: ['totalCharged'] }
)

// ─────────────────────────────────────────
// CLIENTS (admin)
// ─────────────────────────────────────────

export const createClientSchema = z.object({
  name:  z.string().min(2).max(100),
  email: z.string().email('Email inválido'),
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
  showProfessionalStep: z.boolean(),
})
