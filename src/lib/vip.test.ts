// src/lib/vip.test.ts
// VIP multi-service discount — money logic. resolveDiscountPercent is pure;
// getVipSettings reads the DB (mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vipDiscountConfig: { findFirst: vi.fn() },
    vipDiscountTier:   { findMany: vi.fn() },
  },
}))

const { prisma } = await import('@/lib/prisma')
const { resolveDiscountPercent, getVipSettings } = await import('./vip')

const withTiers = (tiers: { minServices: number; discountPct: number }[], enabled = true) => ({ enabled, tiers })

beforeEach(() => vi.clearAllMocks())

describe('resolveDiscountPercent', () => {
  const tiers = [
    { minServices: 2, discountPct: 10 },
    { minServices: 3, discountPct: 15 },
    { minServices: 5, discountPct: 25 },
  ]

  it('0 con menos de 2 servicios', () => {
    expect(resolveDiscountPercent(0, withTiers(tiers))).toBe(0)
    expect(resolveDiscountPercent(1, withTiers(tiers))).toBe(0)
  })

  it('0 si el VIP está deshabilitado, aunque el conteo califique', () => {
    expect(resolveDiscountPercent(5, withTiers(tiers, false))).toBe(0)
  })

  it('aplica el tramo exacto', () => {
    expect(resolveDiscountPercent(2, withTiers(tiers))).toBe(10)
    expect(resolveDiscountPercent(3, withTiers(tiers))).toBe(15)
    expect(resolveDiscountPercent(5, withTiers(tiers))).toBe(25)
  })

  it('elige el tramo MÁS ALTO aplicable (no el primero)', () => {
    expect(resolveDiscountPercent(4, withTiers(tiers))).toBe(15) // >=3 pero <5
    expect(resolveDiscountPercent(10, withTiers(tiers))).toBe(25) // por encima del último tramo
  })

  it('0 cuando no hay tramos configurados', () => {
    expect(resolveDiscountPercent(3, withTiers([]))).toBe(0)
  })
})

describe('getVipSettings', () => {
  it('enabled=true por defecto cuando no existe config', async () => {
    vi.mocked(prisma.vipDiscountConfig.findFirst).mockResolvedValue(null as never)
    vi.mocked(prisma.vipDiscountTier.findMany).mockResolvedValue([] as never)
    const s = await getVipSettings()
    expect(s.enabled).toBe(true)
    expect(s.tiers).toEqual([])
  })

  it('respeta enabled=false y proyecta solo minServices/discountPct', async () => {
    vi.mocked(prisma.vipDiscountConfig.findFirst).mockResolvedValue({ id: 'c1', enabled: false } as never)
    vi.mocked(prisma.vipDiscountTier.findMany).mockResolvedValue(
      [{ id: 't1', minServices: 2, discountPct: 10, createdAt: new Date() }] as never,
    )
    const s = await getVipSettings()
    expect(s.enabled).toBe(false)
    expect(s.tiers).toEqual([{ minServices: 2, discountPct: 10 }])
  })
})
