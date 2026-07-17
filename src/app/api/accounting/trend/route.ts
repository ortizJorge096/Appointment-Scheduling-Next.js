// src/app/api/accounting/trend/route.ts
// GET /api/accounting/trend → monthly income / expenses / profit for the last N
// months (default 6), for the accounting trend chart. Income mirrors the summary
// endpoint (collected money attributed by service date); expenses are the
// non-deleted ones. Turns the accounting snapshot into a trajectory.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const MONTHS = 6

type Apt = {
  date: Date; paymentStatus: string; amountPaid: number | null; precioFinal: number | null
  service: { price: number }; services: { price: number }[]
}

// Same income rule as /api/accounting: WAIVED/PENDING count nothing; otherwise the
// money actually recorded (amountPaid), else the discounted total, else gross.
function income(a: Apt): number {
  if (a.paymentStatus === 'WAIVED' || a.paymentStatus === 'PENDING') return 0
  const gross = a.services && a.services.length > 1 ? a.services.reduce((s, x) => s + x.price, 0) : a.service.price
  return a.amountPaid ?? a.precioFinal ?? gross
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const now  = new Date()
  const from = startOfMonth(subMonths(now, MONTHS - 1))
  const to   = endOfMonth(now)

  try {
    const [appts, expenses] = await Promise.all([
      prisma.appointment.findMany({
        where: { date: { gte: from, lte: to }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        select: {
          date: true, paymentStatus: true, amountPaid: true, precioFinal: true,
          service: { select: { price: true } }, services: { select: { price: true } },
        },
      }),
      prisma.expense.findMany({
        where: { deletedAt: null, date: { gte: from, lte: to } },
        select: { date: true, amount: true },
      }),
    ])

    // Seed all N months so empty ones render as zero, in chronological order.
    const buckets = new Map<string, { month: string; label: string; income: number; expenses: number }>()
    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = subMonths(now, i)
      buckets.set(format(d, 'yyyy-MM'), { month: format(d, 'yyyy-MM'), label: format(d, 'LLL', { locale: es }), income: 0, expenses: 0 })
    }
    for (const a of appts as Apt[]) {
      const b = buckets.get(format(a.date, 'yyyy-MM'))
      if (b) b.income += income(a)
    }
    for (const e of expenses) {
      const b = buckets.get(format(e.date, 'yyyy-MM'))
      if (b) b.expenses += e.amount
    }

    const months = Array.from(buckets.values()).map((b) => ({ ...b, profit: b.income - b.expenses }))
    return NextResponse.json({ success: true, data: months })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error calculando tendencia:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
