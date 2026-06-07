import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: {
      findMany: vi.fn(),
      create:   vi.fn(),
    },
  },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const MOCK_SERVICES = [
  { id: 's1', name: 'Manicura', description: null, category: 'UNAS', price: 35000, durationMinutes: 45, isActive: true,  order: 1 },
  { id: 's2', name: 'Lifting',  description: null, category: 'PESTANAS', price: 80000, durationMinutes: 60, isActive: false, order: 2 },
]

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}

describe('GET /api/services', () => {
  beforeEach(() => vi.clearAllMocks())

  it('public: only returns active services', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.service.findMany).mockResolvedValue([MOCK_SERVICES[0]])

    const res  = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
  })

  it('admin: returns all services including inactive', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'admin@test.com' } })
    vi.mocked(prisma.service.findMany).mockResolvedValue(MOCK_SERVICES)

    const res  = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })
})

describe('POST /api/services', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ name: 'Nuevo', price: 50000, durationMinutes: 60 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res  = await POST(makeRequest({ name: 'X', price: -1, durationMinutes: 5 }))
    expect(res.status).toBe(400)
  })

  it('creates service when admin and valid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.service.create).mockResolvedValue(MOCK_SERVICES[0])

    const res  = await POST(makeRequest({ name: 'Manicura', price: 35000, durationMinutes: 45 }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
  })

  it('returns 400 when body is invalid JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const req = { json: () => Promise.reject(new Error('bad json')) } as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
