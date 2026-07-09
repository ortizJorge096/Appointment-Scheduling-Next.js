// src/app/api/accounting/route.ts
// GET /api/accounting?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// Financial summary for the period: income, expenses, net profit

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
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
    const [appointments, expenses] = await Promise.all([
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
          service: { select: { price: true } },
          services: { select: { price: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          deletedAt: null,
          date: Object.keys(dateFilter).length ? dateFilter : undefined,
        },
        select: { amount: true, category: true },
      }),
    ])

    type AptRow = {
      paymentStatus: string
      paymentMethod: string | null
      amountPaid: number | null
      precioFinal: number | null
      service: { price: number }
      services: Array<{ price: number }>
    }
    type ExpRow = { amount: number; category: ExpenseCategory }

    // Helper to get total price from appointment (supports multi-service)
    function getTotalPrice(apt: AptRow): number {
      if (apt.services && apt.services.length > 1) {
        return apt.services.reduce((sum, s) => sum + s.price, 0)
      }
      return apt.service.price
    }

    // Income: amountPaid if recorded; else the discounted price (precioFinal)
    // when a manual discount was applied; else the gross service price. Using
    // precioFinal before the gross keeps a discount from inflating revenue.
    const totalIncome = (appointments as AptRow[]).reduce((sum: number, apt: AptRow) => {
      if (apt.paymentStatus === 'WAIVED') return sum
      if (apt.paymentStatus === 'PENDING') return sum
      return sum + (apt.amountPaid ?? apt.precioFinal ?? getTotalPrice(apt))
    }, 0)

    const totalExpenses = (expenses as ExpRow[]).reduce((sum: number, e: ExpRow) => sum + e.amount, 0)
    const netProfit     = totalIncome - totalExpenses

    const paidCount    = (appointments as AptRow[]).filter((a: AptRow) => a.paymentStatus === 'PAID').length
    const pendingCount = (appointments as AptRow[]).filter((a: AptRow) => a.paymentStatus === 'PENDING').length

    // Outstanding balance still owed: PENDING owes the full expected value,
    // PARTIAL owes the remainder after the recorded payment. PAID/WAIVED owe nothing.
    let receivable = 0
    let receivableCount = 0
    for (const apt of appointments as AptRow[]) {
      if (apt.paymentStatus === 'PAID' || apt.paymentStatus === 'WAIVED') continue
      const expected = apt.precioFinal ?? getTotalPrice(apt)
      const balance  = apt.paymentStatus === 'PARTIAL' ? expected - (apt.amountPaid ?? 0) : expected
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
    const methodMap = new Map<string, number>()
    for (const apt of appointments as AptRow[]) {
      if (apt.amountPaid && apt.amountPaid > 0) {
        const m = apt.paymentMethod ?? 'SIN_REGISTRAR'
        methodMap.set(m, (methodMap.get(m) ?? 0) + apt.amountPaid)
      }
    }
    const incomeByPaymentMethod: PaymentMethodBreakdown[] = Array
      .from(methodMap, ([method, amount]) => ({ method: method as PaymentMethodBreakdown['method'], amount }))
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
