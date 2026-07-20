// src/app/api/accounting/export/route.test.ts
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
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(), getUserAgent: vi.fn() }))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { audit }            = await import('@/lib/audit')
const { GET }              = await import('./route')

const MOCK_SESSION = { user: { id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN' } }

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/accounting/export')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString(), headers: new Headers() } as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
  vi.mocked(prisma.expense.findMany).mockResolvedValue([])
  vi.mocked(prisma.quickSale.findMany).mockResolvedValue([])
})

describe('GET /api/accounting/export', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('exports a CSV whose summary and cashbook reconcile with the accounting rules', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { date: new Date('2026-07-03'), paymentStatus: 'PAID', paymentMethod: 'NEQUI', amountPaid: 50000, precioFinal: null, service: { name: 'Manicura', price: 50000 }, services: [] },
      // PENDING charge collected nothing → NOT a movement, only a receivable.
      { date: new Date('2026-07-04'), paymentStatus: 'PENDING', paymentMethod: null, amountPaid: null, precioFinal: 42000, service: { name: 'Pedicura', price: 42000 }, services: [] },
    ] as never)
    vi.mocked(prisma.quickSale.findMany).mockResolvedValue([
      { date: new Date('2026-07-05'), description: 'Retiro de uñas', amount: 20000, paymentMethod: 'EFECTIVO' },
    ] as never)
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      { date: new Date('2026-07-06'), description: 'Esmaltes', category: 'INSUMOS', amount: 30000, notes: 'compra mayorista' },
    ] as never)

    const res  = await GET(makeGetRequest({ dateFrom: '2026-07-01', dateTo: '2026-07-31' }))
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('contabilidad-2026-07-01_2026-07-31.csv')

    // Summary reconciles: income = 50000 (cita) + 20000 (venta) = 70000; expenses 30000.
    expect(body).toContain('"Ingresos","70000"')
    expect(body).toContain('"Gastos","30000"')
    expect(body).toContain('"Utilidad neta","40000"')
    // The uncollected PENDING charge is a receivable, not income.
    expect(body).toContain('"Por cobrar","42000"')
    expect(body).toContain('"Citas con saldo","1"')

    // Cashbook rows (chronological) — the PENDING appointment is absent.
    expect(body).toContain('"2026-07-03","Cita","Manicura","Nequi","50000",""')
    expect(body).toContain('"2026-07-05","Venta rápida","Retiro de uñas","Efectivo","20000",""')
    expect(body).toContain('"2026-07-06","Gasto","Esmaltes","Insumos · compra mayorista","","30000"')
    expect(body).not.toContain('Pedicura')
    // Column totals equal the summary income/expense.
    expect(body).toContain('"TOTALES","","","","70000","30000"')

    // The financial export is audited.
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPORT', entity: 'EXPENSE', entityId: 'accounting' }))
  })

  it('sums a multi-service appointment name and price into one movement', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { date: new Date('2026-07-10'), paymentStatus: 'PAID', paymentMethod: 'EFECTIVO', amountPaid: null, precioFinal: null,
        service: { name: 'Manicura', price: 40000 },
        services: [{ price: 40000, service: { name: 'Manicura' } }, { price: 30000, service: { name: 'Pedicura' } }] },
    ] as never)

    const res  = await GET(makeGetRequest())
    const body = await res.text()

    // amountPaid null → falls back to the summed service price (70000).
    expect(body).toContain('"Cita","Manicura + Pedicura","Efectivo","70000",""')
    expect(body).toContain('"Ingresos","70000"')
  })
})
