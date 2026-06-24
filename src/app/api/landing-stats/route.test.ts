// src/app/api/landing-stats/route.test.ts
import { NextRequest } from 'next/server'
import { GET, PUT } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    landingStats: {
      findFirst: vi.fn(),
      update:    vi.fn(),
      create:    vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
  },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const MOCK_ROW = { id: 'ls1', appointmentsCount: 300, clientsCount: 180, yearsExperience: 3, rating: 4.8 }

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}

describe('GET /api/landing-stats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns stored metrics plus a derived servicesCount', async () => {
    vi.mocked(prisma.landingStats.findFirst).mockResolvedValue(MOCK_ROW)
    vi.mocked(prisma.service.count).mockResolvedValue(25)

    const res  = await GET()
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.appointmentsCount).toBe(300)
    expect(json.data.servicesCount).toBe(25)
    // servicesCount is derived from the active, non-deleted catalog
    expect(prisma.service.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, deletedAt: null } })
    )
  })

  it('creates the singleton row with defaults when missing', async () => {
    vi.mocked(prisma.landingStats.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.landingStats.create).mockResolvedValue(MOCK_ROW)
    vi.mocked(prisma.service.count).mockResolvedValue(0)

    const res  = await GET()
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(prisma.landingStats.create).toHaveBeenCalled()
  })
})

describe('PUT /api/landing-stats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PUT(makeRequest({ appointmentsCount: 400, clientsCount: 200, yearsExperience: 4, rating: 4.8 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an out-of-range rating', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await PUT(makeRequest({ appointmentsCount: 400, clientsCount: 200, yearsExperience: 4, rating: 9 }))
    expect(res.status).toBe(400)
  })

  it('updates the metrics and echoes back the derived servicesCount', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.landingStats.findFirst).mockResolvedValue(MOCK_ROW)
    vi.mocked(prisma.landingStats.update).mockResolvedValue(MOCK_ROW)
    vi.mocked(prisma.service.count).mockResolvedValue(25)

    const res  = await PUT(makeRequest({ appointmentsCount: 400, clientsCount: 200, yearsExperience: 4, rating: 4.9 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.servicesCount).toBe(25)
    expect(prisma.landingStats.update).toHaveBeenCalled()
  })
})
