// src/app/api/services/[id]/route.test.ts
// Regression coverage for the soft-delete change: deleting a service must NOT
// hard-delete (which broke on FK constraints with historical appointments) and
// must be blocked while it has upcoming appointments. Also asserts the audit
// log records a human-readable description instead of a raw id.
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: {
      findUnique: vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    appointment: {
      count: vi.fn(),
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

const VALID_CATEGORY_ID = 'cjld2cjxh0000qzrmn831i7rn'
const BEFORE = { name: 'Manicura', description: null, categoryId: VALID_CATEGORY_ID, price: 35000, durationMinutes: 45, order: 1, isActive: true }
const CTX = (id = 'svc-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}

describe('PATCH /api/services/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ price: 50000 }), CTX())
    expect(res.status).toBe(401)
  })

  it('updates a service and audits a readable description with a diff', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.service.findUnique).mockResolvedValue(BEFORE)
    vi.mocked(prisma.service.update).mockResolvedValue({ id: 'svc-1', price: 50000 })

    const res = await PATCH(makeRequest({ price: 50000 }), CTX())
    expect(res.status).toBe(200)
    expect(prisma.category.findFirst).not.toHaveBeenCalled()

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.entity).toBe('SERVICE')
    expect(entry.description).toMatch(/Manicura/)
    expect(entry.description).not.toMatch(/svc-1/)
    expect(entry.before).toBeDefined()
    expect(entry.after).toBeDefined()
  })

  it('returns 400 when reassigning to a non-existent category', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.category.findFirst).mockResolvedValue(null)

    const res = await PATCH(makeRequest({ categoryId: VALID_CATEGORY_ID }), CTX())
    expect(res.status).toBe(400)
    expect(prisma.service.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/services/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('blocks deletion (409) when there are upcoming appointments', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ name: 'Manicura' })
    vi.mocked(prisma.appointment.count).mockResolvedValue(1)

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/cita/i)
    expect(prisma.service.update).not.toHaveBeenCalled()
    expect(prisma.service.delete).not.toHaveBeenCalled()
  })

  it('soft-deletes (never hard-deletes) and audits a readable description', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ name: 'Manicura' })
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)
    vi.mocked(prisma.service.update).mockResolvedValue({ id: 'svc-1' })

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.service.delete).not.toHaveBeenCalled()
    expect(prisma.service.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    )

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.action).toBe('DELETE')
    expect(entry.description).toMatch(/Manicura/)
    expect(entry.description).not.toMatch(/svc-1/)
  })
})
