// src/app/api/booking-settings/route.ts
// GET → read booking flow settings (public — the booking form needs it)
// PUT → update booking flow settings (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBookingSettings } from '@/lib/bookingSettings'
import { bookingSettingsSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const settings = await getBookingSettings()
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

  const parsed = bookingSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { showProfessionalStep } = parsed.data

  const existing = await prisma.bookingSettings.findFirst()
  if (existing) {
    await prisma.bookingSettings.update({ where: { id: existing.id }, data: { showProfessionalStep } })
  } else {
    await prisma.bookingSettings.create({ data: { showProfessionalStep } })
  }

  await audit({
    action:      'UPDATE',
    entity:      'SERVICE',
    entityId:    'booking-settings',
    userEmail:   session.user?.email ?? undefined,
    ip:          getClientIp(request),
    description: `Configuración de reserva: paso de profesional ${showProfessionalStep ? 'activado' : 'desactivado'}`,
    before:      existing ? { showProfessionalStep: existing.showProfessionalStep } : undefined,
    after:       { showProfessionalStep },
  })

  const settings = await getBookingSettings()
  return NextResponse.json({ success: true, data: settings })
}
