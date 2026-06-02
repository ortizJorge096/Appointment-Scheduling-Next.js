import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateServiceSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = updateServiceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const service = await prisma.service.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json({ success: true, data: service })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  // Verificar que no tenga citas activas
  const active = await prisma.appointment.count({
    where: { serviceId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
  })

  if (active > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'No puedes eliminar un servicio con citas activas. Desactívalo en su lugar.',
      },
      { status: 409 }
    )
  }

  await prisma.service.delete({ where: { id } })

  return NextResponse.json({
    success: true,
    data: { id },
  })
}