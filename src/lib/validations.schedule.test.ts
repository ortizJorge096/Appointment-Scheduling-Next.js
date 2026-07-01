// src/lib/validations.schedule.test.ts
import { describe, it, expect } from 'vitest'
import { scheduleSchema } from './validations'

const base = { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '18:00', isActive: true }

describe('scheduleSchema — lunch break', () => {
  it('accepts a break inside working hours', () => {
    expect(scheduleSchema.safeParse({ ...base, breakStart: '12:00', breakEnd: '14:00' }).success).toBe(true)
  })

  it('treats empty strings as no break (null)', () => {
    const r = scheduleSchema.safeParse({ ...base, breakStart: '', breakEnd: '' })
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.breakStart).toBeNull(); expect(r.data.breakEnd).toBeNull() }
  })

  it('rejects a half-defined break', () => {
    expect(scheduleSchema.safeParse({ ...base, breakStart: '12:00', breakEnd: '' }).success).toBe(false)
  })

  it('rejects a break outside working hours', () => {
    expect(scheduleSchema.safeParse({ ...base, breakStart: '08:00', breakEnd: '10:00' }).success).toBe(false)
  })

  it('rejects an inverted break (end before start)', () => {
    expect(scheduleSchema.safeParse({ ...base, breakStart: '15:00', breakEnd: '13:00' }).success).toBe(false)
  })
})
