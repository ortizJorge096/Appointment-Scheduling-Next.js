// src/app/api/accounting/route.ts
// GET /api/accounting?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// Financial summary for the period: income, expenses, net profit

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { appointmentIncome, appointmentBalance, type AppointmentMoney } from '@/lib/accounting'
import type { ApiResponse, AccountingSummary, CategoryBreakdown, PaymentMethodBreakdown, ExpenseCategory } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<AccountingSummary>>> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'contabilidad:ver')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo   = searchParams.get('dateTo')

  const dateFilter = {
    ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
    ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
  }

  try {
    const [appointments, expenses, quickSales] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          date: Object.keys(dateFilter).length ? dateFilter : undefined,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
        select: {
          paymentStatus: true,
          paymentMethod: true,
          amountPaid: true,
          precioFinal: true,
          // Discounts (order-level and per line) and extras all move the charge —
          // without these the total is the raw catalog sum. See src/lib/accounting.
          descuentoTipo: true,
          descuentoValor: true,
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
        where: {
          deletedAt: null,
          date: Object.keys(dateFilter).length ? dateFilter : undefined,
        },
        select: { amount: true, category: true },
      }),
      prisma.quickSale.findMany({
        where: { date: Object.keys(dateFilter).length ? dateFilter : undefined },
        select: { amount: true, paymentMethod: true },
      }),
    ])

    // Reuses the shared money shape so this route and src/lib/accounting can't drift
    // on which fields the charge depends on; paymentMethod is only for the breakdown.
    type AptRow = AppointmentMoney & { paymentMethod: string | null }
    type ExpRow = { amount: number; category: ExpenseCategory }

    // Income & balance rules live in one place (src/lib/accounting) so this summary
    // and the CSV export can never drift on what counts as collected or as owed.
    const incomeFromAppointments = (appointments as AptRow[]).reduce(
      (sum, apt) => sum + appointmentIncome(apt), 0,
    )

    // Walk-in quick sales (no client/appointment) are collected income too.
    const quickSaleTotal = (quickSales as Array<{ amount: number }>).reduce((sum, q) => sum + q.amount, 0)
    const totalIncome    = incomeFromAppointments + quickSaleTotal

    const totalExpenses = (expenses as ExpRow[]).reduce((sum: number, e: ExpRow) => sum + e.amount, 0)
    const netProfit     = totalIncome - totalExpenses

    const paidCount    = (appointments as AptRow[]).filter((a: AptRow) => a.paymentStatus === 'PAID').length
    const pendingCount = (appointments as AptRow[]).filter((a: AptRow) => a.paymentStatus === 'PENDING').length

    // Outstanding balance still owed (see appointmentBalance): PENDING owes the full
    // expected value, PARTIAL the remainder, PAID/WAIVED nothing.
    let receivable = 0
    let receivableCount = 0
    for (const apt of appointments as AptRow[]) {
      const balance = appointmentBalance(apt)
      if (balance > 0) {
        receivable += balance
        receivableCount += 1
      }
    }

    // Expense breakdown by category, largest first — answers "where is the money going?"
    const catMap = new Map<ExpenseCategory, number>()
    for (const e of expenses as ExpRow[]) {
      const cat = (e.category ?? 'OTROS') as ExpenseCategory
      catMap.set(cat, (catMap.get(cat) ?? 0) + e.amount)
    }
    const expensesByCategory: CategoryBreakdown[] = Array.from(catMap, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Income broken down by how it was received: sum amountPaid per paymentMethod.
    // Money recorded without a method lands in "SIN_REGISTRAR" so the totals reconcile.
    // The two sources are kept apart: only the appointment half exists in the citas
    // list, so the UI can show the composition and deep-link just that part instead
    // of promising a drill-down whose total wouldn't match the figure clicked.
    const aptByMethod = new Map<string, number>()
    const qsByMethod  = new Map<string, number>()
    for (const apt of appointments as AptRow[]) {
      if (apt.amountPaid && apt.amountPaid > 0) {
        const m = apt.paymentMethod ?? 'SIN_REGISTRAR'
        aptByMethod.set(m, (aptByMethod.get(m) ?? 0) + apt.amountPaid)
      }
    }
    for (const q of quickSales as Array<{ amount: number; paymentMethod: string | null }>) {
      if (q.amount > 0) {
        const m = q.paymentMethod ?? 'SIN_REGISTRAR'
        qsByMethod.set(m, (qsByMethod.get(m) ?? 0) + q.amount)
      }
    }
    const incomeByPaymentMethod: PaymentMethodBreakdown[] = Array
      .from(new Set([...aptByMethod.keys(), ...qsByMethod.keys()]))
      .map((method) => {
        const fromAppointments = aptByMethod.get(method) ?? 0
        const fromQuickSales   = qsByMethod.get(method)  ?? 0
        return {
          method: method as PaymentMethodBreakdown['method'],
          amount: fromAppointments + fromQuickSales,
          fromAppointments,
          fromQuickSales,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit,
        marginPct: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
        appointmentCount: appointments.length,
        paidCount,
        pendingCount,
        receivable,
        receivableCount,
        quickSaleTotal,
        expensesByCategory,
        incomeByPaymentMethod,
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error calculando contabilidad:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
