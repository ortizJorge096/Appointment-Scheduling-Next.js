// src/lib/validations.test.ts
import { describe, it, expect } from 'vitest'
import {
  createAppointmentSchema,
  availabilityQuerySchema,
  updateAppointmentSchema,
  createServiceSchema,
  updateServiceSchema,
  scheduleSchema,
  galleryCreateSchema,
  galleryUpdateSchema,
  loginSchema,
  bookingSettingsSchema,
} from './validations'

// ── createAppointmentSchema ──────────────────────────────────────────────
describe('createAppointmentSchema', () => {
  const valid = {
    clientName: 'María García',
    clientEmail: 'maria@test.com',
    clientPhone: '3001234567',
    serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx',
    date: '2026-12-01',
    startTime: '10:00',
  }

  it('acepta datos válidos', () => {
    expect(createAppointmentSchema.safeParse(valid).success).toBe(true)
  })

  // Ids are validated for presence, not encoding: a uuid serviceId is as valid
  // as a cuid one, and an empty one is the only thing the schema should reject.
  it('acepta serviceId uuid', () => {
    expect(createAppointmentSchema.safeParse({
      ...valid, serviceId: '2cf42ae6-3b04-4aba-94dd-e4df8ed553f6',
    }).success).toBe(true)
  })

  it('rechaza serviceId vacío', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, serviceId: '' }).success).toBe(false)
  })

  it('rechaza nombre muy corto', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientName: 'A' }).success).toBe(false)
  })

  it('rechaza email inválido', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientEmail: 'no-email' }).success).toBe(false)
  })

  it('acepta cita sin email (email opcional)', () => {
    const noEmail = { ...valid } as Record<string, unknown>
    delete noEmail.clientEmail
    expect(createAppointmentSchema.safeParse(noEmail).success).toBe(true)
  })

  it('acepta email vacío como "sin email"', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientEmail: '' }).success).toBe(true)
  })

  it('rechaza teléfono muy corto', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientPhone: '123' }).success).toBe(false)
  })

  it('rechaza un móvil incompleto de 9 dígitos', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientPhone: '312456789' }).success).toBe(false)
  })

  it('acepta un móvil de 10 dígitos con formato (espacios/guiones)', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientPhone: '312 456-7890' }).success).toBe(true)
  })

  it('acepta un número con código de país', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, clientPhone: '+57 312 456 7890' }).success).toBe(true)
  })

  it('rechaza fecha con formato incorrecto', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, date: '01/12/2026' }).success).toBe(false)
  })

  it('rechaza hora con formato incorrecto', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, startTime: '10:60' }).success).toBe(false)
  })

  it('acepta notas opcionales', () => {
    const r = createAppointmentSchema.safeParse({ ...valid, notes: 'Quiero esmalte nude' })
    expect(r.success).toBe(true)
  })

  it('rechaza notas muy largas', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, notes: 'x'.repeat(501) }).success).toBe(false)
  })
})

// ── manual discount (updateAppointmentSchema carries the same fields) ─────
describe('discount validation', () => {
  it('accepts a fixed discount with a type', () => {
    expect(updateAppointmentSchema.safeParse({ descuentoTipo: 'VALOR_FIJO', descuentoValor: 5000 }).success).toBe(true)
  })

  it('rejects a percentage over 100', () => {
    expect(updateAppointmentSchema.safeParse({ descuentoTipo: 'PORCENTAJE', descuentoValor: 150 }).success).toBe(false)
  })

  it('rejects a value without a type', () => {
    expect(updateAppointmentSchema.safeParse({ descuentoValor: 10 }).success).toBe(false)
  })

  it('rejects a negative discount', () => {
    expect(updateAppointmentSchema.safeParse({ descuentoTipo: 'VALOR_FIJO', descuentoValor: -1 }).success).toBe(false)
  })

  it('accepts clearing the discount (all null)', () => {
    expect(updateAppointmentSchema.safeParse({ descuentoTipo: null, descuentoValor: null, descuentoMotivo: null }).success).toBe(true)
  })
})

// ── availabilityQuerySchema ──────────────────────────────────────────────
describe('availabilityQuerySchema', () => {
  it('acepta date y serviceId válidos', () => {
    const r = availabilityQuerySchema.safeParse({
      date: '2026-12-01',
      serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx',
    })
    expect(r.success).toBe(true)
  })

  it('rechaza fecha inválida', () => {
    expect(availabilityQuerySchema.safeParse({ date: 'hoy', serviceId: 'clxxx' }).success).toBe(false)
  })
})

// ── updateAppointmentSchema ──────────────────────────────────────────────
describe('updateAppointmentSchema', () => {
  it('acepta status válido', () => {
    expect(updateAppointmentSchema.safeParse({ status: 'CONFIRMED' }).success).toBe(true)
  })

  it('rechaza status desconocido', () => {
    expect(updateAppointmentSchema.safeParse({ status: 'BORRADO' }).success).toBe(false)
  })

  it('acepta objeto vacío (todos opcionales)', () => {
    expect(updateAppointmentSchema.safeParse({}).success).toBe(true)
  })
})

// ── createServiceSchema ──────────────────────────────────────────────────
describe('createServiceSchema', () => {
  const valid = { name: 'Manicura', categoryId: 'cjld2cjxh0000qzrmn831i7rn', price: 35000, durationMinutes: 45 }

  it('acepta servicio válido', () => {
    expect(createServiceSchema.safeParse(valid).success).toBe(true)
  })

  it('exige categoryId', () => {
    const { categoryId, ...withoutCategory } = valid
    void categoryId
    expect(createServiceSchema.safeParse(withoutCategory).success).toBe(false)
  })

  // The id's encoding is not the schema's business. Emptiness is what a form can
  // get wrong; whether the id exists is the foreign key's job.
  it('rechaza categoryId vacío', () => {
    expect(createServiceSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false)
  })

  it('acepta categoryId uuid — así están las categorías reales', () => {
    expect(createServiceSchema.safeParse({
      ...valid, categoryId: '2cf42ae6-3b04-4aba-94dd-e4df8ed553f6',
    }).success).toBe(true)
  })

  it('rechaza precio negativo', () => {
    expect(createServiceSchema.safeParse({ ...valid, price: -1 }).success).toBe(false)
  })

  it('rechaza duración menor a 15 min', () => {
    expect(createServiceSchema.safeParse({ ...valid, durationMinutes: 10 }).success).toBe(false)
  })

  it('rechaza nombre vacío', () => {
    expect(createServiceSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })
})

// ── updateServiceSchema ──────────────────────────────────────────────────
describe('updateServiceSchema', () => {
  it('acepta isActive booleano', () => {
    expect(updateServiceSchema.safeParse({ isActive: false }).success).toBe(true)
  })

  it('acepta parcial', () => {
    expect(updateServiceSchema.safeParse({ price: 50000 }).success).toBe(true)
  })
})

// ── scheduleSchema ───────────────────────────────────────────────────────
describe('scheduleSchema', () => {
  const valid = { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '18:00', isActive: true }

  it('acepta horario válido', () => {
    expect(scheduleSchema.safeParse(valid).success).toBe(true)
  })

  it('rechaza si endTime <= startTime', () => {
    expect(scheduleSchema.safeParse({ ...valid, endTime: '08:00' }).success).toBe(false)
  })

  it('rechaza día desconocido', () => {
    expect(scheduleSchema.safeParse({ ...valid, dayOfWeek: 'FUNDAY' }).success).toBe(false)
  })
})

// ── galleryCreateSchema ──────────────────────────────────────────────────
describe('galleryCreateSchema', () => {
  it('acepta s3Key mínimo', () => {
    expect(galleryCreateSchema.safeParse({ s3Key: 'gallery/img.jpg' }).success).toBe(true)
  })

  it('rechaza s3Key vacío', () => {
    expect(galleryCreateSchema.safeParse({ s3Key: '' }).success).toBe(false)
  })

  it('acepta con description', () => {
    expect(galleryCreateSchema.safeParse({ s3Key: 'gallery/x.jpg', description: 'Diseño floral' }).success).toBe(true)
  })
})

// ── galleryUpdateSchema ──────────────────────────────────────────────────
describe('galleryUpdateSchema', () => {
  it('acepta isActive', () => {
    expect(galleryUpdateSchema.safeParse({ isActive: false }).success).toBe(true)
  })

  it('acepta description nullable', () => {
    expect(galleryUpdateSchema.safeParse({ description: null }).success).toBe(true)
  })
})

// ── loginSchema ───────────────────────────────────────────────────────────
describe('loginSchema', () => {
  it('acepta credenciales válidas', () => {
    expect(loginSchema.safeParse({ email: 'admin@test.com', password: 'secret' }).success).toBe(true)
  })

  it('rechaza email inválido', () => {
    expect(loginSchema.safeParse({ email: 'noEmail', password: 'secret' }).success).toBe(false)
  })

  it('rechaza contraseña muy corta', () => {
    expect(loginSchema.safeParse({ email: 'admin@test.com', password: '123' }).success).toBe(false)
  })
})

// ── bookingSettingsSchema ─────────────────────────────────────────────────
describe('bookingSettingsSchema', () => {
  it('acepta maxAdvanceDays dentro del rango', () => {
    expect(bookingSettingsSchema.safeParse({ maxAdvanceDays: 90 }).success).toBe(true)
  })

  it('acepta solo showProfessionalStep (update parcial)', () => {
    expect(bookingSettingsSchema.safeParse({ showProfessionalStep: false }).success).toBe(true)
  })

  it('rechaza maxAdvanceDays menor a 7', () => {
    expect(bookingSettingsSchema.safeParse({ maxAdvanceDays: 6 }).success).toBe(false)
  })

  it('rechaza maxAdvanceDays mayor a 365', () => {
    expect(bookingSettingsSchema.safeParse({ maxAdvanceDays: 366 }).success).toBe(false)
  })

  it('rechaza un objeto vacío (nada que actualizar)', () => {
    expect(bookingSettingsSchema.safeParse({}).success).toBe(false)
  })
})
