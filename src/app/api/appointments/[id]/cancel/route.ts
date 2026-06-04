import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  let body: { token?: string }
  try {
    body = await _request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body inválido' },
      { status: 400 }
    )
  }

  if (!body.token) {
    return NextResponse.json(
      { success: false, error: 'Token requerido' },
      { status: 400 }
    )
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  })

  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Cita no encontrada' },
      { status: 404 }
    )
  }

  if (appointment.cancelToken !== body.token) {
    return NextResponse.json(
      { success: false, error: 'Token inválido' },
      { status: 403 }
    )
  }

  if (appointment.status === 'CANCELLED') {
    return NextResponse.json(
      { success: true, data: { id, alreadyCancelled: true } }
    )
  }

  // Solo se puede cancelar con al menos 24 horas de anticipación.
  // La fecha se almacena en UTC pero el startTime está en hora Colombia (UTC-5).
  // Convertimos la fecha al timezone del negocio antes de construir el datetime.
  const CANCEL_LIMIT_HOURS = 24
  const dateInBogota = toZonedTime(appointment.date, STUDIO.timezone)
  const dateStr = format(dateInBogota, 'yyyy-MM-dd')
  const appointmentAt = toZonedTime(
    new Date(`${dateStr}T${appointment.startTime}:00`),
    STUDIO.timezone
  )
  const hoursUntil = (appointmentAt.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursUntil < CANCEL_LIMIT_HOURS) {
    return NextResponse.json(
      {
        success: false,
        error: `Solo puedes cancelar con al menos ${CANCEL_LIMIT_HOURS} horas de anticipación.`,
      },
      { status: 409 }
    )
  }

  await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  return NextResponse.json({ success: true, data: { id } })
}
