import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { deleteCalendarEvent } from '@/lib/calendar'

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
  // appointment.date está en UTC; startTime está en hora Colombia (UTC-5).
  // Usamos fromZonedTime para construir el timestamp UTC correcto del inicio de la cita.
  const CANCEL_LIMIT_HOURS = 24
  const dateStr = format(toZonedTime(appointment.date, STUDIO.timezone), 'yyyy-MM-dd')
  const appointmentAt = fromZonedTime(
    `${dateStr}T${appointment.startTime}:00`,
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

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  // Eliminar el evento del calendario (no bloqueante)
  if (updated.calendarEventId) {
    deleteCalendarEvent(updated.calendarEventId)
      .catch((err) => console.error('Error eliminando evento de calendario:', err))
  }

  return NextResponse.json({ success: true, data: { id } })
}
