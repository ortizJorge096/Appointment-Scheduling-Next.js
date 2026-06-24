// src/app/api/categories/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
  },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const CTX = (id = 'cat-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}

describe('PATCH /api/categories/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ isActive: false }), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 400 for an invalid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await PATCH(makeRequest({ order: -1 }), CTX())
    expect(res.status).toBe(400)
  })

  it('returns 409 when renaming to an existing name', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findFirst).mockResolvedValue({ id: 'other' })

    const res = await PATCH(makeRequest({ name: 'Uñas' }), CTX())
    expect(res.status).toBe(409)
  })

  it('returns 404 when the category does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.update).mockRejectedValue(new Error('not found'))

    const res = await PATCH(makeRequest({ isActive: false }), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('updates the category (toggle visibility)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1', isActive: false })

    const res  = await PATCH(makeRequest({ isActive: false }), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })
})

describe('DELETE /api/categories/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('blocks deletion (409) when the category still has services', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.service.count).mockResolvedValue(2)

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/servicio/i)
    expect(prisma.category.update).not.toHaveBeenCalled()
  })

  it('soft-deletes when it has no services', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.service.count).mockResolvedValue(0)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1' })

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // Soft delete: sets deletedAt + isActive, never a hard delete
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    )
  })
})
