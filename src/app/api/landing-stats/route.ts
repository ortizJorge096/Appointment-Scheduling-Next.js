// src/app/api/landing-stats/route.ts
// GET → read landing metrics (public — Hero & Nosotros render them)
// PUT → update the editable metrics (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { getLandingStats } from '@/lib/landingStats'
import { landingStatsSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const stats = await getLandingStats()
  return NextResponse.json({ success: true, data: stats })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'configuracion:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = landingStatsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const existing = await prisma.landingStats.findFirst()
  if (existing) {
    await prisma.landingStats.update({ where: { id: existing.id }, data: parsed.data })
  } else {
    await prisma.landingStats.create({ data: parsed.data })
  }

  await audit({
    action:      'UPDATE',
    entity:      'SERVICE',          // no dedicated entity; mirrors booking-settings convention
    entityId:    'landing-stats',
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: 'Métricas del sitio actualizadas',
    before:      existing ? {
      appointmentsCount: existing.appointmentsCount,
      clientsCount:      existing.clientsCount,
      yearsExperience:   existing.yearsExperience,
      rating:            existing.rating,
    } : undefined,
    after:       { ...parsed.data },
  })

  const stats = await getLandingStats()
  return NextResponse.json({ success: true, data: stats })
}
