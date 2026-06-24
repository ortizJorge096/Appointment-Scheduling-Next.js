// src/app/api/schedules/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    schedule: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      upsert:     vi.fn(),
    },
  },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const MOCK_SCHEDULE = {
  id:        'sch-1',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime:   '18:00',
  isActive:  true,
}

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('GET /api/schedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns schedule list (public)', async () => {
    vi.mocked(prisma.schedule.findMany).mockResolvedValue([MOCK_SCHEDULE])

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].dayOfWeek).toBe('MONDAY')
  })
})

describe('POST /api/schedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest(MOCK_SCHEDULE))
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const req = { json: () => Promise.reject(new Error('bad')) } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when endTime <= startTime', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await POST(makeRequest({ ...MOCK_SCHEDULE, startTime: '18:00', endTime: '09:00' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown dayOfWeek', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await POST(makeRequest({ ...MOCK_SCHEDULE, dayOfWeek: 'FUNDAY' }))
    expect(res.status).toBe(400)
  })

  it('upserts schedule and returns it', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.schedule.upsert).mockResolvedValue(MOCK_SCHEDULE)

    const res  = await POST(makeRequest(MOCK_SCHEDULE))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.dayOfWeek).toBe('MONDAY')
    expect(prisma.schedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dayOfWeek: 'MONDAY' } })
    )
  })
})
