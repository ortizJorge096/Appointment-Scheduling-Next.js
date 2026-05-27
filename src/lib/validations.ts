// src/lib/validations.ts
// Schemas de validación con Zod — valentinajimenez

import { z } from 'zod'

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

// Valida formato HH:MM (ej: "09:00", "18:30")
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
const timeString = z.string().regex(timeRegex, 'Formato de hora inválido. Use HH:MM')

// Valida formato YYYY-MM-DD
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const dateString = z.string().regex(dateRegex, 'Formato de fecha inválido. Use YYYY-MM-DD')

// ─────────────────────────────────────────
// AGENDAMIENTO (público)
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

  date: dateString,

  startTime: timeString,

  notes: z
    .string()
    .max(500, 'Las notas no pueden superar 500 caracteres')
    .optional(),
})

export type CreateAppointmentSchema = z.infer<typeof createAppointmentSchema>

// ─────────────────────────────────────────
// DISPONIBILIDAD (query params)
// ─────────────────────────────────────────

export const availabilityQuerySchema = z.object({
  date: dateString,
  serviceId: z.string().cuid('ID de servicio inválido'),
})

// ─────────────────────────────────────────
// ACTUALIZAR CITA (admin)
// ─────────────────────────────────────────

export const updateAppointmentSchema = z.object({
  status: z
    .enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
    .optional(),

  notes: z.string().max(500).optional(),

  date: dateString.optional(),

  startTime: timeString.optional(),
})

// ─────────────────────────────────────────
// SERVICIOS (admin)
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
// HORARIOS (admin)
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
// FECHAS BLOQUEADAS (admin)
// ─────────────────────────────────────────

export const blockedDateSchema = z.object({
  date: dateString,
  reason: z.string().max(200).optional(),
})

// ─────────────────────────────────────────
// LOGIN (admin)
// ─────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
