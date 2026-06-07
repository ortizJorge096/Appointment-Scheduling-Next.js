// src/app/api/appointments/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { GET, PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}))
vi.mock('@/lib/availability', () => ({
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

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const MOCK_SERVICE = { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 }

const MOCK_APPOINTMENT = {
  id:          'appt-1',
  clientName:  'María García',
  clientEmail: 'maria@test.com',
  clientPhone: '3001234567',
  serviceId:   's1',
  date:        new Date('2026-12-01'),
  startTime:   '10:00',
  endTime:     '10:45',
  status:      'CONFIRMED',
  notes:       null,
  cancelToken: null,
  confirmationSentAt: null,
  reminderSentAt:     null,
  createdAt:          new Date(),
  calendarEventId:    null,
  service: MOCK_SERVICE,
}

const CTX = (id = 'appt-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/appointments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when appointment not found', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest(), CTX())
    expect(res.status).toBe(404)
  })

  it('returns full appointment to admin', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })

    const json = await (await GET(makeRequest(), CTX())).json()
    expect(json.success).toBe(true)
    expect(json.data.clientPhone).toBeDefined()
  })

  it('returns only public fields to unauthenticated user', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(getServerSession).mockResolvedValue(null)

    const json = await (await GET(makeRequest(), CTX())).json()
    expect(json.success).toBe(true)
    expect(json.data.clientPhone).toBeUndefined()
    expect(json.data.clientName).toBeDefined()
  })
})

// ── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/appointments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when appointment not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    const req = { json: () => Promise.reject(new Error('bad')) } as unknown as NextRequest
    const res = await PATCH(req, CTX())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status value', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    const res = await PATCH(makeRequest({ status: 'INVALID_STATUS' }), CTX())
    expect(res.status).toBe(400)
  })

  it('updates status successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED' })

    const res  = await PATCH(makeRequest({ status: 'COMPLETED' }), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })
})

// ── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/appointments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when appointment not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('soft-deletes appointment (sets status CANCELLED)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'CANCELLED' })

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.deleted).toBe(true)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } })
    )
  })
})
