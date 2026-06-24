// src/app/api/expenses/route.ts
// GET  /api/expenses   → list expenses (admin)
// POST /api/expenses   → register expense (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createExpenseSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo   = searchParams.get('dateTo')
  const category = searchParams.get('category')
  const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit    = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
    }
  }

  let expenses, total
  try {
    ;[expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ])
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error listando gastos:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      expenses,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    },
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  let expense
  try {
    expense = await prisma.expense.create({
      data: {
        description: parsed.data.description.trim(),
        amount:      parsed.data.amount,
        date:        new Date(`${parsed.data.date}T12:00:00`),
        category:    parsed.data.category ?? 'OTROS',
        notes:       parsed.data.notes?.trim() ?? null,
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error creando gasto:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  await audit({
    action:      'CREATE',
    entity:      'EXPENSE',
    entityId:    expense.id,
    userEmail:   session.user?.email ?? undefined,
    ip:          getClientIp(request),
    description: `Gasto "${expense.description}" registrado`,
    after:       { description: expense.description, amount: expense.amount, category: expense.category, date: parsed.data.date },
  })

  return NextResponse.json({ success: true, data: expense }, { status: 201 })
}
