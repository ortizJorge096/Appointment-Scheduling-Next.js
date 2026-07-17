// src/app/api/appointments/export/route.test.ts
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { appointment: { findMany: vi.fn() } } }))
vi.mock('@/lib/audit', () => ({
  audit: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1'), getUserAgent: vi.fn(() => 'test'),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { audit }            = await import('@/lib/audit')

const APPT = {
  date: new Date('2026-07-01T00:00:00Z'), startTime: '10:00',
  clientName: 'Ana López', clientPhone: '3001234567', clientEmail: 'ana@x.com',
  status: 'COMPLETED', paymentStatus: 'PAID', paymentMethod: 'EFECTIVO',
  amountPaid: 35000, precioFinal: null, origin: 'MANUAL',
  service: { name: 'Manicura', price: 35000 }, services: [] as unknown[],
}

function getReq(qs = ''): NextRequest {
  return { url: `http://localhost/api/appointments/export${qs}` } as unknown as NextRequest
}

describe('GET /api/appointments/export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await GET(getReq())).status).toBe(401)
  })

  it('full profile includes client contact and audits the export', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([APPT] as never)

    const res = await GET(getReq('?columns=full'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')

    const csv = await res.text()
    expect(csv).toContain('Teléfono')
    expect(csv).toContain('3001234567')
    expect(csv).toContain('Manicura')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPORT', entity: 'APPOINTMENT' }))
  })

  it('accounting profile omits client contact (data minimization)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([APPT] as never)

    const csv = await (await GET(getReq('?columns=accounting'))).text()
    expect(csv).not.toContain('Teléfono')
    expect(csv).not.toContain('3001234567')
    expect(csv).not.toContain('ana@x.com')
    expect(csv).toContain('Manicura') // the service is still exported
  })
})
