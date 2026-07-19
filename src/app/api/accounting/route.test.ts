// src/app/api/accounting/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: { findMany: vi.fn() },
    expense:     { findMany: vi.fn() },
    quickSale:   { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { GET }              = await import('./route')

const MOCK_SESSION = { user: { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' } }

beforeEach(() => { vi.clearAllMocks(); vi.mocked(prisma.quickSale.findMany).mockResolvedValue([]) })

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/accounting')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

describe('GET /api/accounting', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('counts walk-in quick sales as income, alongside appointments', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { paymentStatus: 'PAID', amountPaid: 50000, paymentMethod: 'EFECTIVO', service: { price: 50000 } },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])
    vi.mocked(prisma.quickSale.findMany).mockResolvedValue([
      { amount: 15000, paymentMethod: 'EFECTIVO' },
      { amount: 10000, paymentMethod: null },
    ] as never)

    const json = await (await GET(makeGetRequest())).json()
    expect(json.data.totalIncome).toBe(75000)     // 50000 cita + 15000 + 10000 ventas
    expect(json.data.quickSaleTotal).toBe(25000)
    // The EFECTIVO breakdown merges the appointment and the quick sale.
    const efectivo = json.data.incomeByPaymentMethod.find((m: { method: string }) => m.method === 'EFECTIVO')
    expect(efectivo.amount).toBe(65000)
  })

  it('returns zeroed summary when no data', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.totalIncome).toBe(0)
    expect(json.data.totalExpenses).toBe(0)
    expect(json.data.netProfit).toBe(0)
  })

  it('calculates income from paid appointments', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { paymentStatus: 'PAID',    amountPaid: 50000, service: { price: 60000 } },
      { paymentStatus: 'PARTIAL', amountPaid: 30000, service: { price: 60000 } },
      { paymentStatus: 'PENDING', amountPaid: null,  service: { price: 60000 } },
      { paymentStatus: 'WAIVED',  amountPaid: null,  service: { price: 60000 } },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    const res = await GET(makeGetRequest())
    const json = await res.json()

    // 50000 (PAID amountPaid) + 30000 (PARTIAL amountPaid) = 80000
    expect(json.data.totalIncome).toBe(80000)
    expect(json.data.paidCount).toBe(1)
    expect(json.data.pendingCount).toBe(1)
    expect(json.data.appointmentCount).toBe(4)
    // Receivable: PARTIAL owes 60000-30000=30000, PENDING owes 60000 → 90000 (2 citas)
    expect(json.data.receivable).toBe(90000)
    expect(json.data.receivableCount).toBe(2)
  })

  it('a rendered-but-unpaid past charge (PENDING + precioFinal) is a receivable at its snapshot, not income', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    // What "Cita pasada / Pendiente de pago" writes: PENDING, no amountPaid, and
    // precioFinal snapshotting the exact amount owed (services + extras − discount),
    // which here exceeds the gross catalog price so the two are distinguishable.
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { paymentStatus: 'PENDING', amountPaid: null, precioFinal: 42000, paymentMethod: null, service: { price: 35000 }, services: [] },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    const res = await GET(makeGetRequest())
    const json = await res.json()

    // Not collected → adds nothing to income.
    expect(json.data.totalIncome).toBe(0)
    // Owed in full at the snapshot (precioFinal), not the gross service price (35000).
    expect(json.data.receivable).toBe(42000)
    expect(json.data.receivableCount).toBe(1)
    expect(json.data.pendingCount).toBe(1)
  })

  it('falls back to service price when amountPaid is null for PAID', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { paymentStatus: 'PAID', amountPaid: null, service: { price: 45000 } },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(json.data.totalIncome).toBe(45000)
  })

  it('subtracts expenses from income for net profit', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { paymentStatus: 'PAID', amountPaid: 200000, service: { price: 200000 } },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      { amount: 80000 },
      { amount: 20000 },
    ] as never)

    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(json.data.totalExpenses).toBe(100000)
    expect(json.data.netProfit).toBe(100000)
    // margin = netProfit / income = 100000 / 200000 = 50%
    expect(json.data.marginPct).toBe(50)
  })

  it('groups expenses by category, largest first', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      { amount: 100000, category: 'INSUMOS' },
      { amount: 50000,  category: 'ARRIENDO' },
      { amount: 30000,  category: 'INSUMOS' },
    ] as never)

    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(json.data.expensesByCategory).toEqual([
      { category: 'INSUMOS', amount: 130000 },
      { category: 'ARRIENDO', amount: 50000 },
    ])
  })

  it('groups income by payment method (amountPaid per method, largest first)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { paymentStatus: 'PAID',    amountPaid: 50000, paymentMethod: 'EFECTIVO', service: { price: 50000 } },
      { paymentStatus: 'PAID',    amountPaid: 30000, paymentMethod: 'NEQUI',    service: { price: 30000 } },
      { paymentStatus: 'PARTIAL', amountPaid: 20000, paymentMethod: 'EFECTIVO', service: { price: 60000 } },
      { paymentStatus: 'PAID',    amountPaid: 15000, paymentMethod: null,       service: { price: 15000 } }, // recibido sin método
      { paymentStatus: 'WAIVED',  amountPaid: null,  paymentMethod: null,       service: { price: 40000 } }, // cortesía → no cuenta
      { paymentStatus: 'PENDING', amountPaid: null,  paymentMethod: null,       service: { price: 40000 } }, // sin pago → no cuenta
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    const res = await GET(makeGetRequest())
    const json = await res.json()

    // EFECTIVO 50000+20000=70000, NEQUI 30000, SIN_REGISTRAR 15000 — ordenado desc.
    expect(json.data.incomeByPaymentMethod).toEqual([
      { method: 'EFECTIVO', amount: 70000 },
      { method: 'NEQUI', amount: 30000 },
      { method: 'SIN_REGISTRAR', amount: 15000 },
    ])
  })

  it('accepts dateFrom/dateTo filter params', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.expense.findMany).mockResolvedValue([])

    await GET(makeGetRequest({ dateFrom: '2026-06-01', dateTo: '2026-06-30' }))

    const aptCall = vi.mocked(prisma.appointment.findMany).mock.calls[0][0] as { where: { date?: unknown } }
    expect(aptCall.where?.date).toBeDefined()
  })
})
