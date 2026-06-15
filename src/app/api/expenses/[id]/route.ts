// src/app/api/expenses/[id]/route.ts
// PATCH  /api/expenses/:id  → editar gasto
// DELETE /api/expenses/:id  → eliminar gasto

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateExpenseSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

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
    action:    'UPDATE',
    entity:    'EXPENSE',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    metadata:  parsed.data,
  })

  return NextResponse.json({ success: true, data: expense })
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await params

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
    action:    'DELETE',
    entity:    'EXPENSE',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(_req),
  })

  return NextResponse.json({ success: true, data: { id } })
}
