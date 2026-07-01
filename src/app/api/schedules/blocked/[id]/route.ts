// src/app/api/schedules/blocked/[id]/route.ts
// DELETE /api/schedules/blocked/:id

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { audit, getClientIp } from '@/lib/audit'

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    )
  }
  if (!hasPermission(admin.role, 'horarios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const target = await prisma.blockedDate.findUnique({ where: { id }, select: { date: true } })

  try {
    await prisma.blockedDate.delete({ where: { id } })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Fecha bloqueada no encontrada' },
      { status: 404 }
    )
  }

  const dateLabel = target ? target.date.toISOString().slice(0, 10) : 'desconocida'

  await audit({
    action:      'DELETE',
    entity:      'SCHEDULE',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(_req),
    description: `Fecha desbloqueada: ${dateLabel}`,
  })

  return NextResponse.json({
    success: true,
    data: { id },
  })
}
