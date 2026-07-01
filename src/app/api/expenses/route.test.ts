// src/app/api/expenses/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
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

const MOCK_SESSION = { user: { id: 'a1', email: 'admin@test.com', role: 'SUPER_ADMIN' } }

beforeEach(() => { vi.clearAllMocks() })

const MOCK_EXPENSE = {
  id: 'e1', description: 'Esmaltes UV', amount: 80000,
  date: new Date('2026-06-01'), category: 'INSUMOS', notes: null,
  createdAt: new Date(), updatedAt: new Date(),
}

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/expenses')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

function makePostRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('GET /api/expenses', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns paginated expenses', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([MOCK_EXPENSE] as never)
    vi.mocked(prisma.expense.count).mockResolvedValue(1)

    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.expenses).toHaveLength(1)
    expect(json.data.pagination.total).toBe(1)
  })

  it('filters by dateFrom/dateTo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])
    vi.mocked(prisma.expense.count).mockResolvedValue(0)

    await GET(makeGetRequest({ dateFrom: '2026-06-01', dateTo: '2026-06-30' }))

    const call = vi.mocked(prisma.expense.findMany).mock.calls[0][0] as { where: { date?: unknown } }
    expect(call.where?.date).toBeDefined()
  })
})

describe('POST /api/expenses', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    const res = await POST(makePostRequest({ description: 'ok', amount: -100, date: '2026-06-01' }))
    expect(res.status).toBe(400)
  })

  it('creates expense and returns 201', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.create).mockResolvedValue(MOCK_EXPENSE as never)

    const res = await POST(makePostRequest({
      description: 'Esmaltes UV', amount: 80000, date: '2026-06-01', category: 'INSUMOS',
    }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.description).toBe('Esmaltes UV')
  })

  it('defaults category to OTROS when not provided', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.expense.create).mockResolvedValue({ ...MOCK_EXPENSE, category: 'OTROS' } as never)

    await POST(makePostRequest({ description: 'Varios', amount: 20000, date: '2026-06-01' }))

    const call = vi.mocked(prisma.expense.create).mock.calls[0][0] as { data: { category: string } }
    expect(call.data.category).toBe('OTROS')
  })
})
