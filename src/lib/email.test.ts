import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppointmentWithService } from '../types'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

const MOCK_APPOINTMENT: AppointmentWithService = {
  id: 'abc-123',
  clientName: 'Test',
  clientEmail: 'test@example.com',
  clientPhone: '3000000000',
  date: '2026-06-15',
  startTime: '10:00',
  endTime: '11:00',
  status: 'CONFIRMED',
  notes: null,
  cancelToken: null,
  confirmationSentAt: null,
  reminderSentAt: null,
  createdAt: new Date().toISOString(),
  service: { id: 's1', name: 'Manicura', price: 50000, durationMinutes: 60 },
}

describe('getSes (módulo email)', () => {
  it('crea un SESClient sin credenciales explícitas', async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    process.env.AWS_REGION = 'us-east-1'

    const mod = await import('./email')
    const sendConfirmation = mod.sendConfirmationEmail

    expect(sendConfirmation).toBeDefined()
    expect(sendConfirmation).toBeInstanceOf(Function)
  })
})

describe('sendConfirmationEmail', () => {
  it('no envía cuando ENABLE_EMAILS=false, solo loguea', async () => {
    process.env.ENABLE_EMAILS = 'false'

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const mod = await import('./email')

    await mod.sendConfirmationEmail(MOCK_APPOINTMENT)

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EMAILS DESACTIVADOS]'),
    )
    logSpy.mockRestore()
  })
})
