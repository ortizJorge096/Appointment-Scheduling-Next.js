import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateProfessionalSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

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

  const parsed = updateProfessionalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const professional = await prisma.professional.update({
    where: { id },
    data: parsed.data,
  })

  await audit({
    action:    'UPDATE',
    entity:    'PROFESSIONAL',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    metadata:  { fields: Object.keys(parsed.data) },
  })

  return NextResponse.json({ success: true, data: professional })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const active = await prisma.appointment.count({
    where: { professionalId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
  })

  if (active > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No puedes eliminar un profesional con citas activas. Desactívalo en su lugar.',
      },
      { status: 409 }
    )
  }

  await prisma.professional.delete({ where: { id } })

  await audit({
    action:    'DELETE',
    entity:    'PROFESSIONAL',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(_req),
  })

  return NextResponse.json({ success: true, data: { id } })
}
