// src/app/api/categories/[id]/route.ts
// PATCH  /api/categories/[id] → edit category (admin)
// DELETE /api/categories/[id] → soft delete, blocked if it still has services (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { updateCategorySchema } from '@/lib/validations'
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

  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const before = await prisma.category.findUnique({
    where: { id },
    select: { name: true, description: true, icon: true, order: true, isActive: true },
  })
  if (!before) {
    return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 })
  }

  // If the name changes, guard against duplicates (the slug stays stable so
  // existing ?categoria= links keep working).
  if (parsed.data.name) {
    const name = parsed.data.name.trim()
    const clash = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
      select: { id: true },
    })
    if (clash) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una categoría con ese nombre.' },
        { status: 409 }
      )
    }
  }

  let category
  try {
    category = await prisma.category.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description?.trim() || null } : {}),
        ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
        ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 })
  }

  const verb = parsed.data.isActive === false ? 'desactivada'
             : parsed.data.isActive === true  ? 'activada'
             : 'actualizada'

  await audit({
    action:      'UPDATE',
    entity:      'CATEGORY',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Categoría "${before.name}" ${verb}`,
    before,
    after:       parsed.data,
  })

  return NextResponse.json({ success: true, data: category })
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
  if (!hasPermission(admin.role, 'servicios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const target = await prisma.category.findUnique({ where: { id }, select: { name: true } })

  // Block deletion while the category still has (non-deleted) services.
  const serviceCount = await prisma.service.count({
    where: { categoryId: id, deletedAt: null },
  })
  if (serviceCount > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Esta categoría tiene ${serviceCount} servicio${serviceCount === 1 ? '' : 's'}. Reasigna o elimina los servicios primero.`,
      },
      { status: 409 }
    )
  }

  // Soft delete: keep the row (gallery images may still reference it) but hide it.
  try {
    await prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 })
  }

  await audit({
    action:      'DELETE',
    entity:      'CATEGORY',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Categoría "${target?.name ?? 'desconocida'}" eliminada`,
  })

  return NextResponse.json({ success: true, data: { id } })
}
