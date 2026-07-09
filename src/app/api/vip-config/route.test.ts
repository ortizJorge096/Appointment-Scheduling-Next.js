// src/app/api/vip-config/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ getCurrentAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    vipDiscountConfig: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    vipDiscountTier:   { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction:      vi.fn(),
  },
}))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => undefined) }))
// Real @/lib/permissions and @/lib/vip → exercises the true permission matrix + settings mapping.

const { getCurrentAdmin } = await import('@/lib/authz')
const { prisma }          = await import('@/lib/prisma')
const { audit }           = await import('@/lib/audit')
const { GET, PUT }        = await import('./route')

const ADMIN = { id: 'a1', email: 'a@t.com', name: 'Admin', role: 'ADMIN' }
const VALID = { enabled: true, tiers: [{ minServices: 2, discountPct: 10 }] }

const req = (body: unknown) => ({ json: () => Promise.resolve(body) } as unknown as NextRequest)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/vip-config (público)', () => {
  it('devuelve la configuración sin requerir sesión', async () => {
    vi.mocked(prisma.vipDiscountConfig.findFirst).mockResolvedValue({ id: 'c1', enabled: true } as never)
    vi.mocked(prisma.vipDiscountTier.findMany).mockResolvedValue([{ minServices: 2, discountPct: 10 }] as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.enabled).toBe(true)
    expect(body.data.tiers).toEqual([{ minServices: 2, discountPct: 10 }])
  })
})

describe('PUT /api/vip-config', () => {
  it('401 sin sesión', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    const res = await PUT(req(VALID))
    expect(res.status).toBe(401)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('403 cuando el rol no puede editar configuración (recepcionista)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ ...ADMIN, role: 'RECEPCIONISTA' })
    const res = await PUT(req(VALID))
    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('400 con tramo inválido (minServices < 2) y no persiste', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    const res = await PUT(req({ enabled: true, tiers: [{ minServices: 1, discountPct: 10 }] }))
    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('200: persiste (upsert config + reemplazo de tramos en transacción) y audita', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(prisma.vipDiscountConfig.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.vipDiscountConfig.create).mockResolvedValue({ id: 'c1', enabled: true } as never)
    vi.mocked(prisma.vipDiscountTier.findMany).mockResolvedValue([{ minServices: 2, discountPct: 10 }] as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never)

    const res = await PUT(req(VALID))
    expect(res.status).toBe(200)
    expect(prisma.vipDiscountConfig.create).toHaveBeenCalledWith({ data: { enabled: true } })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1) // deleteMany + createMany atómico
    expect(audit).toHaveBeenCalled()
  })
})
