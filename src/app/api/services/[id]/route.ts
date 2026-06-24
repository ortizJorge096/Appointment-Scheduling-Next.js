import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateServiceSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

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

  // If the category is being changed, make sure the target exists and is available.
  if (parsed.data.categoryId !== undefined) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, deletedAt: null },
      select: { id: true },
    })
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'La categoría seleccionada no existe.' },
        { status: 400 }
      )
    }
  }

  const service = await prisma.service.update({
    where: { id },
    data: parsed.data,
  })

  await audit({
    action:    'UPDATE',
    entity:    'SERVICE',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    metadata:  { fields: Object.keys(parsed.data) },
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

  // Block while it still has upcoming appointments.
  const upcoming = await prisma.appointment.count({
    where: {
      serviceId: id,
      status: { in: ['PENDING', 'CONFIRMED'] },
      date: { gte: new Date(new Date().toDateString()) },
    },
  })

  if (upcoming > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Este servicio tiene ${upcoming} cita${upcoming === 1 ? '' : 's'} próxima${upcoming === 1 ? '' : 's'}. No puedes eliminarlo hasta que pasen o se cancelen.`,
      },
      { status: 409 }
    )
  }

  // Soft delete: hide it from the catalog and the public flow, but keep the row
  // so historical appointments retain their service reference and name.
  await prisma.service.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })

  await audit({
    action:    'DELETE',
    entity:    'SERVICE',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(_req),
  })

  return NextResponse.json({
    success: true,
    data: { id },
  })
}