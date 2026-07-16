// src/app/api/appointments/manual/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    service:     { findUnique: vi.fn(), findMany: vi.fn() },
    appointment: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue(undefined) },
    client:      { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/email', () => ({ sendConfirmationEmail: vi.fn().mockResolvedValue(undefined) }))
// Client resolution is tested in src/lib/clients.test.ts — here we only care that
// the route wires a clientId into the appointment, so mock it to a fixed id.
vi.mock('@/lib/clients', () => ({ resolveOrCreateClient: vi.fn().mockResolvedValue('c1') }))
vi.mock('@/lib/availability', () => ({
  isSlotAvailable: vi.fn(),
  getAvailableSlotsByDuration: vi.fn(),
  timeToMinutes:   vi.fn((t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }),
  minutesToTime:   vi.fn((min: number) => { const h = Math.floor(min / 60); const m = min % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }),
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession }    = await import('next-auth')
const { prisma }              = await import('@/lib/prisma')
const { isSlotAvailable, getAvailableSlotsByDuration } = await import('@/lib/availability')
const { sendConfirmationEmail } = await import('@/lib/email')
const { POST }                = await import('./route')

beforeEach(() => {
  vi.clearAllMocks()
  // Default: the requested 10:00 slot is within hours and free (overridden per test).
  vi.mocked(getAvailableSlotsByDuration).mockResolvedValue({
    slots: [{ startTime: '10:00', endTime: '10:45', available: true }],
    durationMinutes: 45,
  } as never)
})

const MOCK_SESSION = { user: { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' } }
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

  it('rejects PAST dates older than 15 days (backfill limit)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    // A PAST date clearly more than 15 days ago is rejected by the backfill window.
    const res = await POST(makeRequest({ ...VALID_BODY, date: '2020-01-01', mode: 'PAST', totalCharged: 35000 }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/15 días/)
  })

  it('rejects an UPCOMING appointment with a past date (no 15-day message)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    const res = await POST(makeRequest({ ...VALID_BODY, date: '2020-01-01' })) // default mode = UPCOMING
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/hoy o futura/)
  })

  it('returns 404 when service not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([] as never)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('returns 409 when slot is unavailable (without skip)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
    vi.mocked(getAvailableSlotsByDuration).mockResolvedValue({
      slots: [{ startTime: '10:00', endTime: '10:45', available: false }], durationMinutes: 45,
    } as never)

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('rejects an UPCOMING appointment outside business hours', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
    // The studio only offers 09:00 that day; 22:00 isn't a valid slot.
    vi.mocked(getAvailableSlotsByDuration).mockResolvedValue({
      slots: [{ startTime: '09:00', endTime: '09:45', available: true }], durationMinutes: 45,
    } as never)

    const res = await POST(makeRequest({ ...VALID_BODY, startTime: '22:00' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/fuera del horario/)
  })

  it('allows forcing an out-of-hours time with skipAvailabilityCheck', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
    vi.mocked(getAvailableSlotsByDuration).mockResolvedValue({ slots: [], durationMinutes: 45 } as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
      appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(MOCK_APPOINTMENT) },
      client:      { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
    }) as never)

    const res = await POST(makeRequest({ ...VALID_BODY, startTime: '22:00', skipAvailabilityCheck: true }))
    expect(res.status).toBe(201)
    expect(getAvailableSlotsByDuration).not.toHaveBeenCalled()
  })

  it('creates appointment and upserts client', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
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

  it('reactivates a picked client that was archived (clears deletedAt) on manual booking', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
    const pickedId = 'clxxxxxxxxxxxxxxxxxxxxxxx' // valid cuid (same format used for serviceId)
    const update = vi.fn().mockResolvedValue(MOCK_CLIENT)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
      appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(MOCK_APPOINTMENT) },
      client:      { findUnique: vi.fn().mockResolvedValue({ id: pickedId }), update },
    }) as never)

    const res = await POST(makeRequest({ ...VALID_BODY, clientId: pickedId }))
    expect(res.status).toBe(201)
    // The picked client is reactivated (deletedAt cleared) as part of the update.
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: pickedId },
      data:  expect.objectContaining({ deletedAt: null }),
    }))
  })

  it('skips availability check when skipAvailabilityCheck=true', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
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

    it('registers a PAST appointment without a typed total (computed from services)', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
      const create = vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID' })
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create },
        client:      { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
      }) as never)

      const res = await POST(makeRequest({ ...VALID_BODY, date: recentPastDate(2), mode: 'PAST' }))
      expect(res.status).toBe(201)
      expect(create.mock.calls[0][0].data.amountPaid).toBe(35000) // catalog price, no typed total
    })

    it('rejects a PAST appointment dated in the future', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      const res = await POST(makeRequest({
        ...VALID_BODY, date: '2030-01-01', mode: 'PAST', totalCharged: 35000,
      }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/futura/)
    })

    it('rejects a PAST appointment dated today with a time later than now', async () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date('2026-06-15T18:00:00.000Z')) // 13:00 in America/Bogota
        vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
        const res = await POST(makeRequest({
          ...VALID_BODY, date: '2026-06-15', startTime: '17:00', mode: 'PAST', totalCharged: 35000,
        }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/hora actual/)
      } finally {
        vi.useRealTimers()
      }
    })

    it('allows a PAST appointment dated today with a time earlier than now', async () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date('2026-06-15T18:00:00.000Z')) // 13:00 in America/Bogota
        vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
        vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
        vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
          appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID' }) },
          client:      { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
        }))
        const res = await POST(makeRequest({
          ...VALID_BODY, date: '2026-06-15', startTime: '09:00', mode: 'PAST', totalCharged: 35000,
        }))
        expect(res.status).toBe(201)
      } finally {
        vi.useRealTimers()
      }
    })

    it('creates the appointment as COMPLETED/PAID with service + extra total', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
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
        extras: [{ description: 'Tinte extra', amount: 10000 }],
      }))

      expect(res.status).toBe(201)
      const createArgs = create.mock.calls[0][0]
      expect(createArgs.data.status).toBe('COMPLETED')
      expect(createArgs.data.paymentStatus).toBe('PAID')
      expect(createArgs.data.amountPaid).toBe(45000)
      expect(createArgs.data.extras.create[0].description).toBe('Tinte extra')
      expect(createArgs.data.extras.create[0].amount).toBe(10000)
      expect(createArgs.data.services.create[0].price).toBe(35000)
    })

    it('registers a PAST appointment as pending payment (paid=false) — a receivable, not income', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
      const create = vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PENDING' })
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create },
        client:      { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
      }) as never)

      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(2), mode: 'PAST', paid: false,
        paymentMethod: 'EFECTIVO', // ignored when unpaid
      }))
      expect(res.status).toBe(201)
      const data = create.mock.calls[0][0].data
      // The service was rendered (COMPLETED) but nothing was collected.
      expect(data.status).toBe('COMPLETED')
      expect(data.paymentStatus).toBe('PENDING')
      expect(data.amountPaid).toBeUndefined()
      expect(data.paymentMethod).toBeUndefined() // not recorded for an unpaid charge
      // The exact amount owed is snapshotted so accounting's receivable is accurate.
      expect(data.precioFinal).toBe(35000)
    })

    it('applies a per-service discount to the past charge', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([{ id: VALID_BODY.serviceId, name: 'Manicura', price: 35000, durationMinutes: 45 }] as never)
      const create = vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID' })
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create },
        client:      { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
      }) as never)

      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(2), mode: 'PAST',
        services: [{ serviceId: VALID_BODY.serviceId, descuentoTipo: 'PORCENTAJE', descuentoValor: 10 }],
      }))
      expect(res.status).toBe(201)
      const data = create.mock.calls[0][0].data
      expect(data.amountPaid).toBe(31500) // 35000 − 10%
      expect(data.services.create[0].descuentoTipo).toBe('PORCENTAJE')
      expect(data.services.create[0].descuentoValor).toBe(10)
    })

    it('applies an order-level total discount to the past charge', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([{ id: VALID_BODY.serviceId, name: 'Manicura', price: 35000, durationMinutes: 45 }] as never)
      const create = vi.fn().mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID' })
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create },
        client:      { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
      }) as never)

      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(2), mode: 'PAST',
        descuentoTipo: 'VALOR_FIJO', descuentoValor: 5000,
      }))
      expect(res.status).toBe(201)
      const data = create.mock.calls[0][0].data
      expect(data.amountPaid).toBe(30000) // 35000 − 5000
      expect(data.descuentoTipo).toBe('VALOR_FIJO')
      expect(data.precioFinal).toBe(30000)
    })

    it('rejects mixing per-service and order-level discount', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(2), mode: 'PAST',
        descuentoTipo: 'PORCENTAJE', descuentoValor: 10,
        services: [{ serviceId: VALID_BODY.serviceId, descuentoTipo: 'PORCENTAJE', descuentoValor: 5 }],
      }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/no ambos/)
    })

    it('creates per-service extras linked to their service line', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([{ id: VALID_BODY.serviceId, name: 'Manicura', price: 35000, durationMinutes: 45 }] as never)
      const createMany = vi.fn().mockResolvedValue({ count: 1 })
      const createdAppt = { ...MOCK_APPOINTMENT, id: 'appt-1', services: [{ id: 'as-1', serviceId: VALID_BODY.serviceId }] }
      const findUnique = vi.fn().mockResolvedValue(createdAppt)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn({
        appointment: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(createdAppt), findUnique },
        appointmentExtra: { createMany },
        client: { upsert: vi.fn().mockResolvedValue(MOCK_CLIENT) },
      }) as never)

      const res = await POST(makeRequest({
        ...VALID_BODY, date: recentPastDate(2), mode: 'PAST',
        services: [{ serviceId: VALID_BODY.serviceId, extras: [{ description: 'Tinte', amount: 8000 }] }],
      }))
      expect(res.status).toBe(201)
      expect(createMany).toHaveBeenCalled()
      const rows = createMany.mock.calls[0][0].data
      expect(rows[0].appointmentServiceId).toBe('as-1')
      expect(rows[0].amount).toBe(8000)
    })

    it('does not change the UPCOMING (default) creation path', async () => {
      vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
      vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
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
      vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
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
      vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE] as never)
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
