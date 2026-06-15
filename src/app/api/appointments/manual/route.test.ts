// src/app/api/appointments/manual/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    service:     { findUnique: vi.fn() },
    appointment: { findFirst: vi.fn() },
    client:      { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/availability', () => ({
  isSlotAvailable: vi.fn(),
  timeToMinutes:   vi.fn((t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }),
  minutesToTime:   vi.fn((min: number) => { const h = Math.floor(min / 60); const m = min % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }),
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { isSlotAvailable }  = await import('@/lib/availability')
const { POST }             = await import('./route')

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
  cancelToken: 'tok', createdAt: new Date(),
  service: MOCK_SERVICE,
}

const VALID_BODY = {
  clientName: 'Ana López', clientEmail: 'ana@test.com', clientPhone: '3001234567',
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
})
