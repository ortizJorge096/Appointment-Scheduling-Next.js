// src/app/api/testimonials/[id]/route.ts
// PATCH  /api/testimonials/[id] → edit / toggle isActive / change status / reorder (admin)
// DELETE /api/testimonials/[id] → soft delete (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { updateTestimonialSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'
import { initialsFromName } from '@/lib/utils'
import { deleteObject } from '@/lib/s3'
import type { Prisma } from '@prisma/client'

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = updateTestimonialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  // Moderation (approve/reject) requires a higher permission than a plain edit.
  const requiredPerm =
    parsed.data.status === 'APPROVED' || parsed.data.status === 'REJECTED'
      ? 'testimonios:moderar'
      : 'testimonios:editar'
  if (!hasPermission(admin.role, requiredPerm)) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const before = await prisma.testimonial.findUnique({
    where: { id },
    select: { clientName: true, type: true, text: true, stars: true, imageUrl: true, imageKey: true, isActive: true, status: true, order: true },
  })
  if (!before) {
    return NextResponse.json({ success: false, error: 'Testimonio no encontrado' }, { status: 404 })
  }

  const d = parsed.data
  const data: Prisma.TestimonialUpdateInput = {}
  if (d.clientName !== undefined) {
    data.clientName = d.clientName.trim()
    data.initials   = initialsFromName(d.clientName) // keep initials in sync with the name
  }
  if (d.type !== undefined)            data.type = d.type.trim()
  if (d.text !== undefined)            data.text = d.text.trim()
  if (d.stars !== undefined)           data.stars = d.stars
  if (d.imageUrl !== undefined)        data.imageUrl = d.imageUrl
  if (d.imageKey !== undefined)        data.imageKey = d.imageKey
  if (d.order !== undefined)           data.order = d.order
  if (d.isActive !== undefined)        data.isActive = d.isActive
  if (d.status !== undefined)          data.status = d.status
  if (d.rejectionReason !== undefined) data.rejectionReason = d.rejectionReason

  // If the photo was replaced, delete the previous S3 object.
  if (d.imageKey !== undefined && before.imageKey && before.imageKey !== d.imageKey) {
    await deleteObject(before.imageKey)
  }

  const testimonial = await prisma.testimonial.update({ where: { id }, data })

  // Human-readable description (prefers the most meaningful action)
  const name = before.clientName
  let description = `Testimonio de "${name}" actualizado`
  if (d.status === 'APPROVED')      description = `Testimonio de "${name}" aprobado`
  else if (d.status === 'REJECTED') description = `Testimonio de "${name}" rechazado`
  else if (d.isActive === false)    description = `Testimonio de "${name}" desactivado`
  else if (d.isActive === true)     description = `Testimonio de "${name}" activado`

  await audit({
    action:      d.status === 'APPROVED' || d.status === 'REJECTED' ? 'STATUS_CHANGE' : 'UPDATE',
    entity:      'TESTIMONIAL',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description,
    before,
    after:       data as Prisma.InputJsonValue,
  })

  return NextResponse.json({ success: true, data: testimonial })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'testimonios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const target = await prisma.testimonial.findUnique({ where: { id }, select: { clientName: true } })

  // Soft delete: hide everywhere but keep the row (and its S3 image) for history.
  try {
    await prisma.testimonial.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Testimonio no encontrado' }, { status: 404 })
  }

  await audit({
    action:      'DELETE',
    entity:      'TESTIMONIAL',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Testimonio de "${target?.clientName ?? 'desconocido'}" eliminado`,
  })

  return NextResponse.json({ success: true, data: { id } })
}
