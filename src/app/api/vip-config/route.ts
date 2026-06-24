// src/app/api/vip-config/route.ts
// GET → read VIP discount settings (public — the booking form needs it)
// PUT → update VIP discount settings (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVipSettings } from '@/lib/vip'
import { vipConfigSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const settings = await getVipSettings()
  return NextResponse.json({ success: true, data: settings })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = vipConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { enabled, tiers } = parsed.data

  const existing = await prisma.vipDiscountConfig.findFirst()
  if (existing) {
    await prisma.vipDiscountConfig.update({ where: { id: existing.id }, data: { enabled } })
  } else {
    await prisma.vipDiscountConfig.create({ data: { enabled } })
  }

  // Replace all tiers with the submitted set
  await prisma.$transaction([
    prisma.vipDiscountTier.deleteMany({}),
    prisma.vipDiscountTier.createMany({ data: tiers }),
  ])

  await audit({
    action:      'UPDATE',
    entity:      'SERVICE',
    entityId:    'vip-discount-config',
    userEmail:   session.user?.email ?? undefined,
    ip:          getClientIp(request),
    description: `Descuento VIP ${enabled ? 'activado' : 'desactivado'} · ${tiers.length} tramo${tiers.length === 1 ? '' : 's'}`,
    after:       { enabled, tiers },
  })

  const settings = await getVipSettings()
  return NextResponse.json({ success: true, data: settings })
}
