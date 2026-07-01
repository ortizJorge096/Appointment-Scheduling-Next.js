// src/app/api/booking-settings/route.ts
// GET → read booking flow settings (public — the booking form needs it)
// PUT → update booking flow settings (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
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

  const parsed = bookingSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  // Partial update: persist only the fields that were sent.
  const data: { showProfessionalStep?: boolean; maxAdvanceDays?: number } = {}
  if (parsed.data.showProfessionalStep !== undefined) data.showProfessionalStep = parsed.data.showProfessionalStep
  if (parsed.data.maxAdvanceDays !== undefined) data.maxAdvanceDays = parsed.data.maxAdvanceDays

  const existing = await prisma.bookingSettings.findFirst()
  if (existing) {
    await prisma.bookingSettings.update({ where: { id: existing.id }, data })
  } else {
    await prisma.bookingSettings.create({ data })
  }

  const changes: string[] = []
  if (data.showProfessionalStep !== undefined) changes.push(`paso de profesional ${data.showProfessionalStep ? 'activado' : 'desactivado'}`)
  if (data.maxAdvanceDays !== undefined) changes.push(`anticipación máx. ${data.maxAdvanceDays} días`)

  await audit({
    action:      'UPDATE',
    entity:      'SERVICE',
    entityId:    'booking-settings',
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Configuración de reserva: ${changes.join(' · ')}`,
    before:      existing ? { showProfessionalStep: existing.showProfessionalStep, maxAdvanceDays: existing.maxAdvanceDays } : undefined,
    after:       data,
  })

  // The landing (ISR) and /agendar advertise the step count — refresh the cache
  // on toggle so the change is reflected immediately, not up to 1h later.
  revalidatePath('/')
  revalidatePath('/agendar')

  const settings = await getBookingSettings()
  return NextResponse.json({ success: true, data: settings })
}
