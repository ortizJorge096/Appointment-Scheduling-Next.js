// src/app/api/expenses/[id]/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { PATCH, DELETE }    = await import('./route')

const MOCK_SESSION = { user: { id: 'a1', email: 'admin@test.com', role: 'SUPER_ADMIN' } }
const MOCK_EXPENSE = {
  id: 'e1', description: 'Esmaltes UV', amount: 80000,
  date: new Date('2026-06-01'), category: 'INSUMOS', notes: null,
  createdAt: new Date(), updatedAt: new Date(),
}
const ctx = { params: Promise.resolve({ id: 'e1' }) }

function makePatchRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('PATCH /api/expenses/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({}), ctx)
    expect(res.status).toBe(401)
  })

  it('updates expense amount', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.update).mockResolvedValue({ ...MOCK_EXPENSE, amount: 90000 } as never)

    const res = await PATCH(makePatchRequest({ amount: 90000 }), ctx)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 404 when expense not found (P2025)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.update).mockRejectedValue({ code: 'P2025' })

    const res = await PATCH(makePatchRequest({ amount: 5000 }), ctx)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/expenses/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE({} as NextRequest, ctx)
    expect(res.status).toBe(401)
  })

  it('soft-deletes expense and returns id', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.update).mockResolvedValue(MOCK_EXPENSE as never)

    const res = await DELETE({} as NextRequest, ctx)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('e1')
  })

  it('returns 404 when expense not found (P2025)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.update).mockRejectedValue({ code: 'P2025' })

    const res = await DELETE({} as NextRequest, ctx)
    expect(res.status).toBe(404)
  })
})
