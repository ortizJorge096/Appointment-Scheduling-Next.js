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

  it('rechaza categoryId que no es cuid', () => {
    expect(createServiceSchema.safeParse({ ...valid, categoryId: '123' }).success).toBe(false)
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
