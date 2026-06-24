// src/app/api/categories/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
  },
}))
// Mock audit so we can assert the human-readable contract (and avoid the real
// prisma.auditLog write). The route also imports getClientIp from this module.
vi.mock('@/lib/audit', () => ({
  audit:        vi.fn(),
  getClientIp:  vi.fn(),
  getUserAgent: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { audit }            = await import('@/lib/audit')

const BEFORE = { name: 'Uñas', description: null, icon: 'manicura', order: 1, isActive: true }
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

  it('returns 404 when the category does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null)

    const res = await PATCH(makeRequest({ isActive: false }), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 409 when renaming to an existing name', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findUnique).mockResolvedValue(BEFORE)
    vi.mocked(prisma.category.findFirst).mockResolvedValue({ id: 'other' })

    const res = await PATCH(makeRequest({ name: 'Pestañas' }), CTX())
    expect(res.status).toBe(409)
  })

  it('updates the category and audits a readable description with a diff', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findUnique).mockResolvedValue(BEFORE)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1', isActive: false })

    const res = await PATCH(makeRequest({ isActive: false }), CTX())
    expect(res.status).toBe(200)

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.entity).toBe('CATEGORY')
    expect(entry.description).toMatch(/Uñas/)        // display name, not an id
    expect(entry.description).not.toMatch(/cat-1/)   // never the raw id
    expect(entry.before).toBeDefined()
    expect(entry.after).toBeDefined()
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
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ name: 'Uñas' })
    vi.mocked(prisma.service.count).mockResolvedValue(2)

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/servicio/i)
    expect(prisma.category.update).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('soft-deletes and audits a readable description (no id)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ name: 'Uñas' })
    vi.mocked(prisma.service.count).mockResolvedValue(0)
    vi.mocked(prisma.category.update).mockResolvedValue({ id: 'cat-1' })

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    )

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.action).toBe('DELETE')
    expect(entry.description).toMatch(/Uñas/)
    expect(entry.description).not.toMatch(/cat-1/)
  })
})
