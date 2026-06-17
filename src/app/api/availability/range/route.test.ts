// src/app/api/availability/range/route.test.ts
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    service:      { findUnique: vi.fn() },
    schedule:     { findMany: vi.fn() },
    blockedDate:  { findMany: vi.fn() },
    appointment:  { findMany: vi.fn() },
  },
}))

const { prisma } = await import('@/lib/prisma')

const MOCK_SERVICE  = { durationMinutes: 45 }

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/availability/range')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

function defaultMocks() {
  vi.mocked(prisma.service.findUnique).mockResolvedValue(MOCK_SERVICE)
  // Todos los días habilitados
  vi.mocked(prisma.schedule.findMany).mockResolvedValue([
    { dayOfWeek: 'MONDAY',    startTime: '09:00', endTime: '18:00', isActive: true },
    { dayOfWeek: 'TUESDAY',   startTime: '09:00', endTime: '18:00', isActive: true },
    { dayOfWeek: 'WEDNESDAY', startTime: '09:00', endTime: '18:00', isActive: true },
    { dayOfWeek: 'THURSDAY',  startTime: '09:00', endTime: '18:00', isActive: true },
    { dayOfWeek: 'FRIDAY',    startTime: '09:00', endTime: '18:00', isActive: true },
    { dayOfWeek: 'SATURDAY',  startTime: '09:00', endTime: '18:00', isActive: true },
    { dayOfWeek: 'SUNDAY',    startTime: '09:00', endTime: '18:00', isActive: false },
  ])
  vi.mocked(prisma.blockedDate.findMany).mockResolvedValue([])
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
}

describe('GET /api/availability/range', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when dates are missing', async () => {
    const res = await GET(makeRequest({ serviceId: 's1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when serviceId is missing', async () => {
    const res = await GET(makeRequest({ from: '2026-12-01', to: '2026-12-07' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when from > to', async () => {
    const res = await GET(makeRequest({ from: '2026-12-07', to: '2026-12-01', serviceId: 's1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when date format is invalid', async () => {
    const res = await GET(makeRequest({ from: '01-12-2026', to: '2026-12-07', serviceId: 's1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when service not found or inactive', async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest({ from: '2026-12-01', to: '2026-12-07', serviceId: 'bad' }))
    expect(res.status).toBe(404)
  })

  it('returns open:false for blocked dates', async () => {
    defaultMocks()
    vi.mocked(prisma.blockedDate.findMany).mockResolvedValue([
      { date: new Date('2026-12-01') },
      { date: new Date('2026-12-02') },
    ])

    const res  = await GET(makeRequest({ from: '2026-12-01', to: '2026-12-02', serviceId: 's1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    json.data.dates.forEach((d: { open: boolean }) => expect(d.open).toBe(false))
  })

  it('returns correct structure for a valid range', async () => {
    defaultMocks()

    const res  = await GET(makeRequest({ from: '2026-12-07', to: '2026-12-09', serviceId: 's1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.dates)).toBe(true)
    expect(json.data.dates).toHaveLength(3)
    json.data.dates.forEach((d: { date: string; open: boolean }) => {
      expect(d).toHaveProperty('date')
      expect(d).toHaveProperty('open')
    })
  })

  it('caps range at 60 days', async () => {
    defaultMocks()

    const res  = await GET(makeRequest({ from: '2026-01-01', to: '2026-12-31', serviceId: 's1' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.dates.length).toBeLessThanOrEqual(60)
  })
})
