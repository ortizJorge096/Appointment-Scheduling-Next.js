// src/app/api/accounting/trend/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: { appointment: { findMany: vi.fn() }, expense: { findMany: vi.fn() }, quickSale: { findMany: vi.fn() } },
}))
vi.mock('@/lib/db-error', () => ({ isDbUnavailable: vi.fn(() => false), dbUnavailableResponse: vi.fn() }))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { GET }              = await import('./route')

function req(): NextRequest { return {} as unknown as NextRequest }

describe('GET /api/accounting/trend', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(prisma.quickSale.findMany).mockResolvedValue([]) })
  afterEach(() => vi.useRealTimers())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('buckets income and expenses by month across the 6-month window', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-15T12:00:00'))
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { date: new Date('2026-07-10T12:00:00'), paymentStatus: 'PAID',    amountPaid: 50000, precioFinal: null, service: { price: 60000 }, services: [] },
      { date: new Date('2026-07-12T12:00:00'), paymentStatus: 'PENDING', amountPaid: null,  precioFinal: null, service: { price: 60000 }, services: [] },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      { date: new Date('2026-07-05T12:00:00'), amount: 20000 },
    ] as never)

    const json = await (await GET(req())).json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(6)

    const jul = json.data[json.data.length - 1]
    expect(jul.month).toBe('2026-07')
    expect(jul.income).toBe(50000)   // PAID amountPaid; the PENDING one contributes 0
    expect(jul.expenses).toBe(20000)
    expect(jul.profit).toBe(30000)

    // Empty earlier months are still present and zeroed (so the chart has no gaps).
    expect(json.data[0].income).toBe(0)
    expect(json.data[0].expenses).toBe(0)
  })
})
