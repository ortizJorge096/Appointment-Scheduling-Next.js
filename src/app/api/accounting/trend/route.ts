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
import { appointmentIncome, type AppointmentMoney } from '@/lib/accounting'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const MONTHS = 6

// Income uses the SHARED rule (src/lib/accounting) rather than a local copy — the
// previous copy summed raw catalog prices and so ignored discounts and extras.
type Apt = AppointmentMoney & { date: Date }

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'contabilidad:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const now  = new Date()
  const from = startOfMonth(subMonths(now, MONTHS - 1))
  const to   = endOfMonth(now)

  try {
    const [appts, expenses, quickSales] = await Promise.all([
      prisma.appointment.findMany({
        where: { date: { gte: from, lte: to }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        select: {
          date: true, paymentStatus: true, amountPaid: true, precioFinal: true,
          // Discounts + extras move the charge — see src/lib/accounting.
          descuentoTipo: true, descuentoValor: true,
          extras:   { select: { amount: true, appointmentServiceId: true } },
          service:  { select: { price: true } },
          services: {
            select: {
              price: true, descuentoTipo: true, descuentoValor: true,
              extras: { select: { amount: true } },
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: { deletedAt: null, date: { gte: from, lte: to } },
        select: { date: true, amount: true },
      }),
      prisma.quickSale.findMany({
        where: { date: { gte: from, lte: to } },
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
      if (b) b.income += appointmentIncome(a)
    }
    for (const e of expenses) {
      const b = buckets.get(format(e.date, 'yyyy-MM'))
      if (b) b.expenses += e.amount
    }
    for (const q of quickSales) {
      const b = buckets.get(format(q.date, 'yyyy-MM'))
      if (b) b.income += q.amount
    }

    const months = Array.from(buckets.values()).map((b) => ({ ...b, profit: b.income - b.expenses }))
    return NextResponse.json({ success: true, data: months })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error calculando tendencia:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
