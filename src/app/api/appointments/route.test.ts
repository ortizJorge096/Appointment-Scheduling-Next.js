// src/app/api/appointments/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findMany:  vi.fn(),
      count:     vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
    },
    service: { findUnique: vi.fn(), findMany: vi.fn() },
    client:  { findUnique: vi.fn() },
    vipDiscountConfig: { findFirst: vi.fn() },
    vipDiscountTier:   { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/availability', () => ({
  isSlotAvailable: vi.fn(),
  timeToMinutes: vi.fn((t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }),
  minutesToTime: vi.fn((min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }),
}))
vi.mock('@/lib/email',    () => ({
  sendConfirmationEmail:    vi.fn().mockResolvedValue(undefined),
  sendAdminNewBookingEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/calendar', () => ({ createCalendarEvent:  vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/audit', () => ({
  audit:        vi.fn(),
  getClientIp:  vi.fn(() => undefined),
  getUserAgent: vi.fn(() => undefined),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 5 }),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { isSlotAvailable }  = await import('@/lib/availability')
const { audit }            = await import('@/lib/audit')
const { rateLimit }        = await import('@/lib/rate-limit')

const MOCK_SERVICE = { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 }

const MOCK_APPOINTMENT = {
  id: 'appt-1',
  clientName: 'María García',
  clientEmail: 'maria@test.com',
  clientPhone: '3001234567',
  clientId: null,
  serviceId:   's1',
  date:        new Date('2026-12-01'),
  startTime:   '10:00',
  endTime:     '10:45',
  status:      'CONFIRMED',
  source:      'ONLINE',
  paymentStatus: 'PENDING',
  paymentMethod: null,
  amountPaid: null,
  notes:       null,
  cancelToken: null,
  calendarEventId: null,
  confirmationSentAt: null,
  reminderSentAt:     null,
  createdAt:          new Date(),
  totalDurationMinutes: 45,
  service: MOCK_SERVICE,
  services: [],
}

const VALID_BODY = {
  clientName:  'María García',
  clientEmail: 'maria@test.com',
  clientPhone: '3001234567',
  serviceId:   'clxxxxxxxxxxxxxxxxxxxxxxx',
  date:        '2026-12-01',
  startTime:   '10:00',
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/appointments')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

function makePostRequest(body?: unknown, ip = '1.2.3.4'): NextRequest {
  const headers = new Headers({ 'x-forwarded-for': ip })
  return {
    json:    () => Promise.resolve(body),
    headers,
    url:     'http://localhost/api/appointments',
  } as unknown as NextRequest
}

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/appointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res  = await GET(makeGetRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).success).toBe(false)
  })

  it('returns paginated appointment list for admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([MOCK_APPOINTMENT])
    vi.mocked(prisma.appointment.count).mockResolvedValue(1)

    const res  = await GET(makeGetRequest({ page: '1', limit: '10' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.appointments).toHaveLength(1)
    expect(json.data.pagination).toMatchObject({ total: 1, page: 1, limit: 10 })
  })

  it('filters by status query param', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ status: 'CONFIRMED' }))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMED' }) })
    )
  })

  it('filters by dateFrom and dateTo', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ dateFrom: '2026-12-01', dateTo: '2026-12-31' }))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: expect.any(Object) }) })
    )
  })

  it('filters by origin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ origin: 'VIP' }))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ origin: 'VIP' }) })
    )
  })

  it('builds an OR free-text search (client, service, code)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ search: 'ana' }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = vi.mocked(prisma.appointment.findMany).mock.calls[0][0]!.where as any
    expect(Array.isArray(where.OR)).toBe(true)
    expect(where.OR).toHaveLength(4)
  })

  it('scope=all removes the date window', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ scope: 'all' }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = vi.mocked(prisma.appointment.findMany).mock.calls[0][0]!.where as any
    expect(where.date).toBeUndefined()
  })

  it('filters by value range over amountPaid (finds cortesías $0)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ amountMin: '0', amountMax: '0' }))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ amountPaid: { gte: 0, lte: 0 } }) })
    )
  })
})

// ── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/appointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for malformed JSON', async () => {
    const req = {
      json:    () => Promise.reject(new Error('bad json')),
      headers: new Headers({ 'x-forwarded-for': '2.2.2.1' }),
      url:     'http://localhost',
    } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid body schema', async () => {
    const res = await POST(makePostRequest({ clientName: 'X' }, '2.2.2.2'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when service not found or inactive', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([])
    const res = await POST(makePostRequest(VALID_BODY, '2.2.2.3'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('servicios')
  })

  it('returns 409 when slot is not available', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE])
    vi.mocked(isSlotAvailable).mockResolvedValue(false)
    const res = await POST(makePostRequest(VALID_BODY, '2.2.2.4'))
    expect(res.status).toBe(409)
  })

  it('creates appointment and returns 201', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE])
    vi.mocked(isSlotAvailable).mockResolvedValue(true)
    vi.mocked(prisma.$transaction).mockResolvedValue(MOCK_APPOINTMENT)

    const res  = await POST(makePostRequest(VALID_BODY, '2.2.2.5'))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('appt-1')
    // Public booking is audited as a CLIENT action (fire-and-forget)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'APPOINTMENT', actorType: 'CLIENT' }),
    )
  })

  it('creates appointment without email (email optional)', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE])
    vi.mocked(isSlotAvailable).mockResolvedValue(true)
    vi.mocked(prisma.$transaction).mockResolvedValue({ ...MOCK_APPOINTMENT, clientEmail: null })

    const noEmail = {
      clientName: 'María García', clientPhone: '3001234567',
      serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx', date: '2026-12-01', startTime: '10:00',
    }
    const res = await POST(makePostRequest(noEmail, '2.2.2.7'))
    expect(res.status).toBe(201)
  })

  it('returns 500 when transaction throws unexpected error', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICE])
    vi.mocked(isSlotAvailable).mockResolvedValue(true)
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('DB error'))

    const res = await POST(makePostRequest(VALID_BODY, '2.2.2.6'))
    expect(res.status).toBe(500)
  })

  it('rechaza el honeypot lleno (bot rellena todos los campos) con 400', async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, website: 'http://spam' }, '2.2.9.1'))
    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rechaza un envío instantáneo (elapsedMs < 3s → probable bot) con 400', async () => {
    const res = await POST(makePostRequest({ ...VALID_BODY, elapsedMs: 100 }, '2.2.9.2'))
    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('bloquea con 429 (UPCOMING_CAP) cuando el teléfono ya tiene el máximo de citas próximas', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 'cli-1', deletedAt: null } as never)
    vi.mocked(prisma.appointment.count).mockResolvedValue(3) // = MAX_UPCOMING_PER_PHONE
    const res  = await POST(makePostRequest({ ...VALID_BODY, elapsedMs: 5000 }, '2.2.9.3'))
    const json = await res.json()
    expect(res.status).toBe(429)
    expect(json.code).toBe('UPCOMING_CAP')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('bloquea con 403 (CLIENT_INACTIVE) cuando el cliente está archivado/inactivo', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ id: 'cli-1', deletedAt: new Date() } as never)
    const res  = await POST(makePostRequest({ ...VALID_BODY, elapsedMs: 5000 }, '2.2.9.4'))
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.code).toBe('CLIENT_INACTIVE')
    // No cuenta citas ni abre transacción: se corta antes.
    expect(prisma.appointment.count).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 429 when the shared rate limiter blocks the IP', async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, remaining: 0 })
    const res = await POST(makePostRequest(VALID_BODY, '9.9.9.9'))
    expect(res.status).toBe(429)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
