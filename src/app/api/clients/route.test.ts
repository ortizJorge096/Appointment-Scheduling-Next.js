// src/app/api/clients/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      findMany: vi.fn(),
      count:    vi.fn(),
      create:   vi.fn(),
    },
  },
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { GET, POST }        = await import('./route')

const MOCK_SESSION = { user: { email: 'admin@test.com' } }

beforeEach(() => { vi.clearAllMocks() })

const MOCK_CLIENT = {
  id: 'c1', name: 'Ana López', email: 'ana@test.com',
  phone: '3001234567', notes: null,
  createdAt: new Date('2026-01-01'), updatedAt: new Date(),
  _count: { appointments: 3 },
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/clients')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

function makePostRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('GET /api/clients', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns paginated clients list', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findMany).mockResolvedValue([MOCK_CLIENT] as never)
    vi.mocked(prisma.client.count).mockResolvedValue(1)

    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.clients).toHaveLength(1)
    expect(json.data.pagination.total).toBe(1)
  })

  it('passes search param to where clause', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findMany).mockResolvedValue([])
    vi.mocked(prisma.client.count).mockResolvedValue(0)

    await GET(makeGetRequest({ search: 'ana' }))

    const call = vi.mocked(prisma.client.findMany).mock.calls[0][0] as { where: unknown }
    expect(call.where).toHaveProperty('OR')
  })
})

describe('POST /api/clients', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    const res = await POST(makePostRequest({ name: 'A', email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('creates client and returns 201', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.create).mockResolvedValue(MOCK_CLIENT as never)

    const res = await POST(makePostRequest({
      name: 'Ana López', email: 'ana@test.com', phone: '3001234567',
    }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.email).toBe('ana@test.com')
  })

  it('returns 409 on duplicate email (P2002)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.create).mockRejectedValue({ code: 'P2002' })

    const res = await POST(makePostRequest({
      name: 'Ana López', email: 'ana@test.com', phone: '3001234567',
    }))
    expect(res.status).toBe(409)
  })
})
