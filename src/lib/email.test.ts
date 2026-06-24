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
  clientId: null,
  date: '2026-06-15',
  startTime: '10:00',
  endTime: '11:00',
  status: 'CONFIRMED',
  source: 'ONLINE',
  paymentStatus: 'PENDING',
  paymentMethod: null,
  amountPaid: null,
  notes: null,
  cancelToken: null,
  calendarEventId: null,
  confirmationSentAt: null,
  reminderSentAt: null,
  createdAt: new Date().toISOString(),
  totalDurationMinutes: 60,
  service: { id: 's1', name: 'Manicura', price: 50000, durationMinutes: 60 },
  services: [],
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

  it('omite en silencio (y nunca toca SES) cuando el cliente no tiene email', async () => {
    // Even with emails enabled, a null recipient must short-circuit before SES.
    process.env.ENABLE_EMAILS = 'true'

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const mod = await import('./email')

    await expect(
      mod.sendConfirmationEmail({ ...MOCK_APPOINTMENT, clientEmail: null }),
    ).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[SIN EMAIL]'))
    logSpy.mockRestore()
  })
})
