// src/app/api/expenses/[id]/route.ts
// PATCH  /api/expenses/:id  → edit expense
// DELETE /api/expenses/:id  → delete expense

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { updateExpenseSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { id } = await params

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const before = await prisma.expense.findUnique({
    where: { id },
    select: { description: true, amount: true, category: true, notes: true },
  })

  let expense
  try {
    expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(parsed.data.description ? { description: parsed.data.description.trim() } : {}),
        ...(parsed.data.amount      ? { amount:      parsed.data.amount }              : {}),
        ...(parsed.data.date        ? { date: new Date(`${parsed.data.date}T12:00:00`) } : {}),
        ...(parsed.data.category    ? { category:    parsed.data.category }             : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() ?? null } : {}),
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Gasto no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  await audit({
    action:      'UPDATE',
    entity:      'EXPENSE',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Gasto "${expense.description}" actualizado`,
    before:      before ?? undefined,
    after:       parsed.data,
  })

  return NextResponse.json({ success: true, data: expense })
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { id } = await params

  const target = await prisma.expense.findUnique({ where: { id }, select: { description: true } })

  try {
    await prisma.expense.delete({ where: { id } })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Gasto no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  await audit({
    action:      'DELETE',
    entity:      'EXPENSE',
    entityId:    id,
    userEmail:   admin.email,
    ip:          getClientIp(_req),
    description: `Gasto "${target?.description ?? 'desconocido'}" eliminado`,
  })

  return NextResponse.json({ success: true, data: { id } })
}
