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

  await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  return NextResponse.json({ success: true, data: { id } })
}
