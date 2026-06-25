// src/app/api/categories/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  audit:        vi.fn(),
  getClientIp:  vi.fn(),
  getUserAgent: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { audit }            = await import('@/lib/audit')

const MOCK_CATEGORIES = [
  { id: 'c1', name: 'Uñas', slug: 'unas', description: null, icon: 'manicura', order: 1, isActive: true, _count: { services: 3 } },
]

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}
function getReq(url = 'http://localhost/api/categories'): NextRequest {
  return { url } as NextRequest
}

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.category.findMany).mockResolvedValue(MOCK_CATEGORIES)
  })

  it('public: returns only active, non-deleted categories', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const res  = await GET(getReq())
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })

  it('admin without the flag still gets active-only (public site must never leak inactive)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'admin@test.com' } })

    await GET(getReq())

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })

  it('admin with ?includeInactive=true gets all non-deleted categories', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'admin@test.com' } })

    await GET(getReq('http://localhost/api/categories?includeInactive=true'))

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    )
  })

  it('includeInactive without a session is ignored (stays active-only)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await GET(getReq('http://localhost/api/categories?includeInactive=true'))

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })
})

describe('POST /api/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ name: 'Spa' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid name', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await POST(makeRequest({ name: 'X' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when the name already exists', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findFirst).mockResolvedValueOnce({ id: 'dup', deletedAt: null })

    const res = await POST(makeRequest({ name: 'Uñas' }))
    expect(res.status).toBe(409)
  })

  it('creates a category with a slug generated from the name', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findFirst)
      .mockResolvedValueOnce(null)          // duplicate-name check
      .mockResolvedValueOnce({ order: 4 })  // last order
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null) // slug is unique
    vi.mocked(prisma.category.create).mockResolvedValue({ id: 'c2', name: 'Spa', slug: 'spa' })

    const res  = await POST(makeRequest({ name: 'Spa', icon: 'promo' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'spa' }) })
    )

    // Audit records a readable description with the display name, never the id
    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.action).toBe('CREATE')
    expect(entry.description).toMatch(/Spa/)
    expect(entry.description).not.toMatch(/c2/)
  })

  it('rejects an invalid icon key', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await POST(makeRequest({ name: 'Spa', icon: 'not-an-icon' }))
    expect(res.status).toBe(400)
  })
})
