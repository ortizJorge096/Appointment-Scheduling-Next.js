// src/app/api/quick-sales/route.ts
// GET  /api/quick-sales   → list quick sales (admin)
// POST /api/quick-sales   → register a walk-in quick sale, no client/appointment (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { createQuickSaleSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo   = searchParams.get('dateTo')
  const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit    = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

  const where: Record<string, unknown> = {}
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
    }
  }

  let sales, total
  try {
    ;[sales, total] = await Promise.all([
      prisma.quickSale.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      prisma.quickSale.count({ where }),
    ])
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error listando ventas rápidas:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { sales, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } } })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = createQuickSaleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })

  let sale
  try {
    sale = await prisma.quickSale.create({
      data: {
        description:   parsed.data.description.trim(),
        amount:        parsed.data.amount,
        date:          new Date(`${parsed.data.date}T12:00:00`),
        paymentMethod: parsed.data.paymentMethod ?? null,
        serviceId:     parsed.data.serviceId ?? null,
        notes:         parsed.data.notes?.trim() ?? null,
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error creando venta rápida:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  // Audited as SERVICE (a service was sold) — the description makes it explicit.
  await audit({
    action:      'CREATE',
    entity:      'SERVICE',
    entityId:    sale.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Venta rápida "${sale.description}" registrada`,
    after:       { description: sale.description, amount: sale.amount, paymentMethod: sale.paymentMethod, date: parsed.data.date },
  })

  return NextResponse.json({ success: true, data: sale }, { status: 201 })
}
