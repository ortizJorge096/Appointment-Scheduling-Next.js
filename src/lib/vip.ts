// src/lib/vip.ts
// VIP multi-service discount — parametrized via DB (VipDiscountConfig + VipDiscountTier).
// Rule: booking 2+ services (any category) unlocks a tiered discount.

import { prisma } from '@/lib/prisma'

export interface VipTier {
  minServices: number
  discountPct: number
}

export interface VipSettings {
  enabled: boolean
  tiers: VipTier[] // sorted ascending by minServices
}

/** Reads the current VIP config from the DB (creates sane defaults if missing). */
export async function getVipSettings(): Promise<VipSettings> {
  const [config, tiers] = await Promise.all([
    prisma.vipDiscountConfig.findFirst(),
    prisma.vipDiscountTier.findMany({ orderBy: { minServices: 'asc' } }),
  ])

  return {
    enabled: config?.enabled ?? true,
    tiers: (tiers ?? []).map((t) => ({ minServices: t.minServices, discountPct: t.discountPct })),
  }
}

/** Given a service count and the VIP settings, returns the applicable discount percent (0 if none). */
export function resolveDiscountPercent(serviceCount: number, settings: VipSettings): number {
  if (!settings.enabled || serviceCount < 2) return 0
  // Highest tier whose minServices <= serviceCount
  const applicable = settings.tiers
    .filter((t) => serviceCount >= t.minServices)
    .sort((a, b) => b.minServices - a.minServices)[0]
  return applicable?.discountPct ?? 0
}
