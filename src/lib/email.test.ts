import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppointmentWithService } from '../types'

// Mock the Resend SDK so a test never sends a real email, and we can assert on
// exactly what would have been sent (recipient, subject, from, body). vi.hoisted
// makes sendMock available inside the (hoisted) vi.mock factory.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock('resend', () => ({
  // Resend is used as a constructor (`new Resend(key)`), so the mock impl must be
  // constructable. Arrow functions aren't ("is not a constructor") — use a real
  // function that populates `this` with the mocked emails.send.
  Resend: vi.fn(function (this: Record<string, unknown>) {
    this.emails = { send: sendMock }
  }),
}))
// Audit writes to the DB; stub it so the failure path doesn't touch Prisma.
vi.mock('./audit', () => ({ audit: vi.fn() }))

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null })
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

describe('sendConfirmationEmail', () => {
  it('no envía (ni construye el request) cuando ENABLE_EMAILS=false', async () => {
    process.env.ENABLE_EMAILS = 'false'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mod = await import('./email')
    await mod.sendConfirmationEmail(MOCK_APPOINTMENT)

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[EMAILS DESACTIVADOS]'))
    expect(sendMock).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('omite en silencio (y nunca toca Resend) cuando el cliente no tiene email', async () => {
    process.env.ENABLE_EMAILS = 'true'
    process.env.RESEND_API_KEY = 're_test'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mod = await import('./email')
    await expect(
      mod.sendConfirmationEmail({ ...MOCK_APPOINTMENT, clientEmail: null }),
    ).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[SIN EMAIL]'))
    expect(sendMock).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('envía por Resend al destinatario con asunto, remitente y HTML correctos', async () => {
    process.env.ENABLE_EMAILS = 'true'
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'info@vjbeautystudio.com'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const mod = await import('./email')
    await mod.sendConfirmationEmail(MOCK_APPOINTMENT)

    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.to).toEqual(['test@example.com'])
    expect(arg.subject).toContain('Cita confirmada')
    expect(arg.from).toContain('info@vjbeautystudio.com')
    expect(arg.html).toContain('Test')       // client name rendered in the body
    expect(arg.html).toContain('Manicura')   // service name rendered in the body
  })

  it('propaga el error cuando Resend responde { error }', async () => {
    process.env.ENABLE_EMAILS = 'true'
    process.env.RESEND_API_KEY = 're_test'
    sendMock.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit', message: 'rate limited' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const mod = await import('./email')
    await expect(mod.sendConfirmationEmail(MOCK_APPOINTMENT)).rejects.toThrow('rate limited')
  })

  it('arma el link de cancelación con host aunque NEXT_PUBLIC_APP_URL esté vacío (cae a NEXTAUTH_URL)', async () => {
    // Regression: a build that didn't bake NEXT_PUBLIC_APP_URL leaves it as "".
    // The old `??` kept that empty string → hostless links ("http:///cancelar").
    // The fix uses `||` + a NEXTAUTH_URL fallback (a runtime var) so the link
    // always has a host.
    process.env.ENABLE_EMAILS = 'true'
    process.env.RESEND_API_KEY = 're_test'
    process.env.NEXT_PUBLIC_APP_URL = ''                    // empty baked value
    process.env.NEXTAUTH_URL = 'https://test.example.com'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const mod = await import('./email')
    await mod.sendConfirmationEmail({ ...MOCK_APPOINTMENT, cancelToken: 'tok-xyz' })

    const arg = sendMock.mock.calls[0][0]
    expect(arg.html).toContain('https://test.example.com/cancelar?id=abc-123&token=tok-xyz')
    expect(arg.html).not.toContain('href="/cancelar')       // never hostless
  })
})
