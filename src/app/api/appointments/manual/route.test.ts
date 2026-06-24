// src/app/api/appointments/manual/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    service:     { findUnique: vi.fn() },
    appointment: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue(undefined) },
    client:      { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/email', () => ({ sendConfirmationEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/availability', () => ({
  isSlotAvailable: vi.fn(),
  timeToMinutes:   vi.fn((t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }),
  minutesToTime:   vi.fn((min: number) => { const h = Math.floor(min / 60); const m = min % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }),
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession }    = await import('next-auth')
const { prisma }              = await import('@/lib/prisma')
const { isSlotAvailable }     = await import('@/lib/availability')
const { sendConfirmationEmail } = await import('@/lib/email')
const { POST }                = await import('./route')

beforeEach(() => { vi.clearAllMocks() })

const MOCK_SESSION = { user: { email: 'admin@test.com' } }
const MOCK_SERVICE = { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 }
const MOCK_CLIENT  = { id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '3001234567' }
const MOCK_APPOINTMENT = {
  id: 'appt-1', clientName: 'Ana López', clientEmail: 'ana@test.com',
  clientPhone: '3001234567', clientId: 'c1',
  serviceId: 's1', date: new Date('2026-12-01'),
  startTime: '10:00', endTime: '10:45', status: 'CONFIRMED',
  source: 'PRESENCIAL', paymentStatus: 'PENDING',
  paymentMethod: null, amountPaid: null, notes: null,
  cancelToken: 'tok', calendarEventId: null,
  confirmationSentAt: null, reminderSentAt: null,
  createdAt: new Date(), totalDurationMinutes: 45,
  service: MOCK_SERVICE,
  services: [],
}

const VALID_BODY = {
  clientName: 'Ana López', clientEmail: 'ana@test.com', clientPhone: '3001234567',
  serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx', date: '2026-12-01',
  startTime: '10:00', source: 'PRESENCIAL',
}

const NO_EMAIL_BODY = {
  clientName: 'Ana López', clientPhone: '3001234567',
  serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx', date: '2026-12-01',
  startTime: '10:00', source: 'PRESENCIAL',
}

function makeRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('POST /api/appointments/manual', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    const res = await POST(makeRequest({ clientName: 'A' }))
    expect(res.status).toBe(400)
  })

  it('rejects dates older than 15 days (backfill limit)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    // A date clearly more than 15 days in the past is always rejected
    const res = await POST(makeRequest({ ...VALID_BODY, date: '2020-01-01' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/15 días/)
  })

  it('returns 404 when service not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('returns 409 when slot is unavailable (without skip)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'conflict-1' } as never)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('creates appointment and upserts client', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(MOCK_APPOINTMENT) },
        client:      { upsert:    vi.fn().mockResolvedValue(MOCK_CLIENT) },
      })
    })

    const res = await POST(makeRequest(VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.source).toBe('PRESENCIAL')
  })

  it('skips availability check when skipAvailabilityCheck=true', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      return fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(MOCK_APPOINTMENT) },
        client:      { upsert:    vi.fn().mockResolvedValue(MOCK_CLIENT) },
      })
    })

    const res = await POST(makeRequest({ ...VALID_BODY, skipAvailabilityCheck: true }))
    expect(isSlotAvailable).not.toHaveBeenCalled()
    expect(res.status).toBe(201)
  })

  describe('mode: PAST ("Cita pasada")', () => {
    // The 15-day backfill window is relative to "today", so dates are computed at run time.
    function recentPastDate(daysAgo: number) {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      return d.toISOString().slice(0, 10)
    }

    it('rejects a PAST appointment without totalCharged', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      const res = await POST(makeRequest({ ...VALID_BODY, date: recentPastDate(2), mode: 'PAST' }))
      expect(res.status).toBe(400)
    })

    it('rejects a PAST appointment dated today or later', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(0), mode: 'PAST', totalCharged: 35000,
      }))
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toMatch(/anterior a hoy/)
    })

    it('creates the appointment as COMPLETED/PAID with service + extra total', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
      const create = vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID', amountPaid: 45000 })
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          appointment: { findFirst: vi.fn().mockResolvedValue(null), create },
          client:      { upsert:    vi.fn().mockResolvedValue(MOCK_CLIENT) },
        })
      })

      const res = await POST(makeRequest({
        ...VALID_BODY,
        date: recentPastDate(2),
        mode: 'PAST',
        totalCharged: 35000,
        extraDescription: 'Tinte extra',
        extraAmount: 10000,
      }))

      expect(res.status).toBe(201)
      const createArgs = create.mock.calls[0][0]
      expect(createArgs.data.status).toBe('COMPLETED')
      expect(createArgs.data.paymentStatus).toBe('PAID')
      expect(createArgs.data.amountPaid).toBe(45000)
      expect(createArgs.data.extraDescription).toBe('Tinte extra')
      expect(createArgs.data.extraAmount).toBe(10000)
      expect(createArgs.data.services.create[0].price).toBe(35000)
    })

    it('does not change the UPCOMING (default) creation path', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
      const create = vi.fn().mockResolvedValue(MOCK_APPOINTMENT)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          appointment: { findFirst: vi.fn().mockResolvedValue(null), create },
          client:      { upsert:    vi.fn().mockResolvedValue(MOCK_CLIENT) },
        })
      })

      const res = await POST(makeRequest(VALID_BODY))
      expect(res.status).toBe(201)
      const createArgs = create.mock.calls[0][0]
      expect(createArgs.data.status).toBe('CONFIRMED')
      expect(createArgs.data.paymentStatus).toBeUndefined()
      expect(createArgs.data.services.create[0].price).toBe(MOCK_SERVICE.price)
    })
  })

  describe('notifyClient (checkbox de notificación)', () => {
    function mockTransaction(appt = MOCK_APPOINTMENT) {
      vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn({
          appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(appt) },
          client:      { upsert:    vi.fn().mockResolvedValue(MOCK_CLIENT) },
        })
      })
    }

    it('does not send a confirmation email by default (notifyClient unset)', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      mockTransaction()
      const res = await POST(makeRequest(VALID_BODY))
      expect(res.status).toBe(201)
      expect(sendConfirmationEmail).not.toHaveBeenCalled()
    })

    it('sends a confirmation email when notifyClient=true on an UPCOMING appointment', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      mockTransaction()
      const res = await POST(makeRequest({ ...VALID_BODY, notifyClient: true }))
      expect(res.status).toBe(201)
      expect(sendConfirmationEmail).toHaveBeenCalledWith(MOCK_APPOINTMENT)
    })

    it('never sends a confirmation email for a PAST appointment, even if notifyClient=true', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      function recentPastDate(daysAgo: number) {
        const d = new Date()
        d.setDate(d.getDate() - daysAgo)
        return d.toISOString().slice(0, 10)
      }
      mockTransaction({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID', amountPaid: 35000 })
      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(2), mode: 'PAST', totalCharged: 35000, notifyClient: true,
      }))
      expect(res.status).toBe(201)
      expect(sendConfirmationEmail).not.toHaveBeenCalled()
    })
  })

  describe('sin email (cliente opcional)', () => {
    // tx mock that exposes the no-email path (findFirst + create), not upsert
    function mockNoEmailTransaction(upsert = vi.fn()) {
      vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE as never)
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
        fn({
          appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, clientEmail: null }) },
          client: {
            upsert,
            findFirst: vi.fn().mockResolvedValue(null),
            create:    vi.fn().mockResolvedValue({ ...MOCK_CLIENT, email: null }),
          },
        }),
      )
    }

    it('crea la cita sin email (no usa upsert-por-email)', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      const upsert = vi.fn()
      mockNoEmailTransaction(upsert)

      const res = await POST(makeRequest(NO_EMAIL_BODY))
      expect(res.status).toBe(201)
      expect(upsert).not.toHaveBeenCalled()
    })

    it('no envía confirmación sin email aunque notifyClient=true', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      mockNoEmailTransaction()

      const res = await POST(makeRequest({ ...NO_EMAIL_BODY, notifyClient: true }))
      expect(res.status).toBe(201)
      expect(sendConfirmationEmail).not.toHaveBeenCalled()
    })
  })
})
