// src/lib/landingStats.ts
// Landing marketing metrics (singleton). `servicesCount` is always derived from
// the live catalog so it can never contradict the real number of services.

import { prisma } from '@/lib/prisma'

export interface LandingStats {
  appointmentsCount: number
  clientsCount: number
  yearsExperience: number
  rating: number
  servicesCount: number // derived — count of active, non-deleted services
}

/** Reads the landing stats, creating the singleton row with defaults if missing. */
export async function getLandingStats(): Promise<LandingStats> {
  const [row, servicesCount] = await Promise.all([
    prisma.landingStats.findFirst(),
    prisma.service.count({ where: { isActive: true, deletedAt: null } }),
  ])

  const stats = row ?? (await prisma.landingStats.create({ data: {} }))

  return {
    appointmentsCount: stats.appointmentsCount,
    clientsCount:      stats.clientsCount,
    yearsExperience:   stats.yearsExperience,
    rating:            stats.rating,
    servicesCount,
  }
}
