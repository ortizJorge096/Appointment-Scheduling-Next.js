// src/app/api/quick-sales/[id]/route.ts
// DELETE /api/quick-sales/:id → remove a quick sale (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { id } = await context.params
  const sale = await prisma.quickSale.findUnique({ where: { id } })
  if (!sale) return NextResponse.json({ success: false, error: 'Venta no encontrada' }, { status: 404 })

  await prisma.quickSale.delete({ where: { id } })

  await audit({
    action:      'DELETE',
    entity:      'SERVICE',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Venta rápida "${sale.description}" eliminada`,
    before:      { description: sale.description, amount: sale.amount },
  })

  return NextResponse.json({ success: true, data: { id, deleted: true } })
}
