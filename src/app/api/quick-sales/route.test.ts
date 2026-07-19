// src/app/api/quick-sales/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { quickSale: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() } } }))
vi.mock('@/lib/db-error', () => ({ isDbUnavailable: vi.fn(() => false), dbUnavailableResponse: vi.fn() }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { audit }            = await import('@/lib/audit')

function makeReq(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body), url: 'http://localhost/api/quick-sales' } as unknown as NextRequest
}
function getReq(): NextRequest {
  return { url: 'http://localhost/api/quick-sales' } as unknown as NextRequest
}

describe('POST /api/quick-sales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await POST(makeReq({ description: 'Retiro de uñas', amount: 15000, date: '2026-07-16' }))).status).toBe(401)
  })

  it('returns 400 when the amount is not positive', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    expect((await POST(makeReq({ description: 'Retiro de uñas', amount: 0, date: '2026-07-16' }))).status).toBe(400)
  })

  it('registers a walk-in sale (no client, no appointment) and audits it', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.quickSale.create).mockResolvedValue({
      id: 'qs1', description: 'Retiro de uñas', amount: 15000, paymentMethod: 'EFECTIVO',
      date: new Date('2026-07-16'), serviceId: null, notes: null, createdAt: new Date(),
    } as never)

    const res = await POST(makeReq({ description: 'Retiro de uñas', amount: 15000, date: '2026-07-16', paymentMethod: 'EFECTIVO' }))
    expect(res.status).toBe(201)
    const data = vi.mocked(prisma.quickSale.create).mock.calls[0][0].data
    expect(data.description).toBe('Retiro de uñas')
    expect(data.amount).toBe(15000)
    expect(data.serviceId).toBeNull() // no catalog service → free text
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'SERVICE' }))
  })
})

describe('GET /api/quick-sales', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists quick sales for an authorized admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.quickSale.findMany).mockResolvedValue([{ id: 'qs1', description: 'Retiro de uñas', amount: 15000 }] as never)
    vi.mocked(prisma.quickSale.count).mockResolvedValue(1 as never)

    const json = await (await GET(getReq())).json()
    expect(json.success).toBe(true)
    expect(json.data.sales).toHaveLength(1)
  })
})
