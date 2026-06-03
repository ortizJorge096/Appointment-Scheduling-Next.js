import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  // Solo se puede cancelar con al menos 24 horas de anticipación
  const CANCEL_LIMIT_HOURS = 24
  const appointmentAt = new Date(
    `${appointment.date.toISOString().split('T')[0]}T${appointment.startTime}:00`
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
