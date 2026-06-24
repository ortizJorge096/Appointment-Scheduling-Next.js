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

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { isSlotAvailable }  = await import('@/lib/availability')

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
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
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
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ status: 'CONFIRMED' }))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMED' }) })
    )
  })

  it('filters by dateFrom and dateTo', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)

    await GET(makeGetRequest({ dateFrom: '2026-12-01', dateTo: '2026-12-31' }))

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: expect.any(Object) }) })
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

  it('returns 429 after exceeding rate limit for same IP', async () => {
    const ip = '9.9.9.9'
    vi.mocked(prisma.service.findMany).mockResolvedValue([])

    // 5 allowed, 6th should be rate limited
    for (let i = 0; i < 5; i++) {
      await POST(makePostRequest(VALID_BODY, ip))
    }
    const res = await POST(makePostRequest(VALID_BODY, ip))
    expect(res.status).toBe(429)
  })
})
