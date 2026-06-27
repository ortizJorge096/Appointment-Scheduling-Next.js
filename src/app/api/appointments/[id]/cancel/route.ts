import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { CANCEL_LIMIT_HOURS, isWithinCancelWindow } from '@/lib/cancellation'
import { deleteCalendarEvent } from '@/lib/calendar'
import { sendAdminCancellationEmail } from '@/lib/email'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import type { AppointmentWithService } from '@/types'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  let body: { token?: string }
  try {
    body = await request.json()
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

  // Can only be cancelled at least 24 hours ahead (enforced here; the UI also
  // gates the button via the `cancellable` flag from the appointment GET).
  if (!isWithinCancelWindow(appointment.date, appointment.startTime)) {
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
    include: {
      service:  { select: { id: true, name: true, price: true, durationMinutes: true } },
      services: { include: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } } },
    },
  })

  // Delete the calendar event (non-blocking)
  if (updated.calendarEventId) {
    deleteCalendarEvent(updated.calendarEventId)
      .catch((err) => console.error('Error eliminando evento de calendario:', err))
  }

  // Notify the admin — this cancellation was initiated by the client, not by the admin
  sendAdminCancellationEmail(updated as unknown as AppointmentWithService)
    .catch((err) => console.error('Error notificando al admin de la cancelación:', err))

  // Audit the client-initiated cancellation (fire-and-forget). Never store the token.
  audit({
    action:    'CANCEL',
    entity:    'APPOINTMENT',
    entityId:  id,
    actorType: 'CLIENT',
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    before:    { status: appointment.status },
    after:     { status: 'CANCELLED' },
    description: `Cliente ${updated.clientName} canceló su cita del ${format(toZonedTime(appointment.date, STUDIO.timezone), 'yyyy-MM-dd')} a las ${appointment.startTime}`,
  })

  return NextResponse.json({ success: true, data: { id } })
}
