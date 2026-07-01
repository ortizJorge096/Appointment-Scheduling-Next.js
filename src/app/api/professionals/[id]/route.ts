import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { updateProfessionalSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'servicios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
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

  const before = await prisma.professional.findUnique({
    where: { id },
    select: { name: true, specialty: true, rating: true, reviewCount: true, isActive: true, order: true },
  })
  if (!before) {
    return NextResponse.json({ success: false, error: 'Profesional no encontrado' }, { status: 404 })
  }

  const professional = await prisma.professional.update({
    where: { id },
    data: parsed.data,
  })

  const verb = parsed.data.isActive === false ? 'desactivado'
             : parsed.data.isActive === true  ? 'activado'
             : 'actualizado'

  await audit({
    action:      'UPDATE',
    entity:      'PROFESSIONAL',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Profesional "${before.name}" ${verb}`,
    before,
    after:       parsed.data,
  })

  return NextResponse.json({ success: true, data: professional })
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'servicios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const target = await prisma.professional.findUnique({ where: { id }, select: { name: true } })

  // Block while it still has upcoming appointments (avoids deleting someone
  // with pending work). Past appointments are fine — soft delete keeps the row,
  // so their professionalId reference stays intact.
  const upcoming = await prisma.appointment.count({
    where: {
      professionalId: id,
      status: { in: ['PENDING', 'CONFIRMED'] },
      date: { gte: new Date(new Date().toDateString()) },
    },
  })

  if (upcoming > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Este profesional tiene ${upcoming} cita${upcoming === 1 ? '' : 's'} próxima${upcoming === 1 ? '' : 's'}. Desactívalo o reasigna esas citas antes de eliminarlo.`,
      },
      { status: 409 }
    )
  }

  // Soft delete: hide it everywhere but keep the row so historical appointments
  // retain their professional reference (no SetNull, no orphaned records).
  await prisma.professional.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })

  await audit({
    action:      'DELETE',
    entity:      'PROFESSIONAL',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(_req),
    description: `Profesional "${target?.name ?? 'desconocido'}" eliminado`,
  })

  return NextResponse.json({ success: true, data: { id } })
}
