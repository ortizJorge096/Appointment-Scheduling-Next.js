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

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const MOCK_CATEGORIES = [
  { id: 'c1', name: 'Uñas', slug: 'unas', description: null, icon: 'manicura', order: 1, isActive: true, _count: { services: 3 } },
]

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}

describe('GET /api/categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('public: returns only active, non-deleted categories', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.category.findMany).mockResolvedValue(MOCK_CATEGORIES)

    const res  = await GET()
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })

  it('admin: returns all non-deleted categories (including inactive)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'admin@test.com' } })
    vi.mocked(prisma.category.findMany).mockResolvedValue(MOCK_CATEGORIES)

    await GET()

    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
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
  })

  it('rejects an invalid icon key', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await POST(makeRequest({ name: 'Spa', icon: 'not-an-icon' }))
    expect(res.status).toBe(400)
  })
})
