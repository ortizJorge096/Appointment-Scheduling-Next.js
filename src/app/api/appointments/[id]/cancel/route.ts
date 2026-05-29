// src/app/api/appointments/:id/cancel/route.ts
// POST → cancelación pública de una cita mediante token (sin login).
// El token va en el enlace del email de confirmación.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { fromZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

const CANCEL_WINDOW_HOURS = 24

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ success: false, error: 'Falta el token de cancelación' }, { status: 400 })
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { service: { select: { name: true } } },
  })

  if (!appointment || appointment.cancelToken !== token) {
    return NextResponse.json(
      { success: false, error: 'No encontramos esta cita o el enlace no es válido.' },
      { status: 404 }
    )
  }

  if (appointment.status === 'CANCELLED') {
    return NextResponse.json({ success: true, data: { id, alreadyCancelled: true } })
  }

  if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
    return NextResponse.json(
      { success: false, error: 'Esta cita ya no se puede cancelar.' },
      { status: 409 }
    )
  }

  // Instante real de la cita en zona horaria del negocio
  const ymd = format(appointment.date, 'yyyy-MM-dd')
  const apptInstant = fromZonedTime(`${ymd}T${appointment.startTime}:00`, STUDIO.timezone)
  const hoursUntil = (apptInstant.getTime() - Date.now()) / (1000 * 60 * 60)

  if (hoursUntil < CANCEL_WINDOW_HOURS) {
    return NextResponse.json(
      {
        success: false,
        error: `Las cancelaciones deben hacerse con al menos ${CANCEL_WINDOW_HOURS} horas de anticipación. Por favor contáctanos.`,
      },
      { status: 409 }
    )
  }

  await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  return NextResponse.json({ success: true, data: { id, cancelled: true } })
}
