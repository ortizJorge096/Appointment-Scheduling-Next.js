// src/app/api/accounting/route.ts
// GET /api/accounting?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// Financial summary for the period: income, expenses, net profit

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import type { ApiResponse, AccountingSummary } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<AccountingSummary>>> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
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
          amountPaid: true,
          service: { select: { price: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          date: Object.keys(dateFilter).length ? dateFilter : undefined,
        },
        select: { amount: true },
      }),
    ])

    type AptRow = { paymentStatus: string; amountPaid: number | null; service: { price: number } }
    type ExpRow = { amount: number }

    // Income: sum of amountPaid (PAID or PARTIAL), or service price if PAID without an amount
    const totalIncome = (appointments as AptRow[]).reduce((sum: number, apt: AptRow) => {
      if (apt.paymentStatus === 'WAIVED') return sum
      if (apt.paymentStatus === 'PENDING') return sum
      return sum + (apt.amountPaid ?? apt.service.price)
    }, 0)

    const totalExpenses = (expenses as ExpRow[]).reduce((sum: number, e: ExpRow) => sum + e.amount, 0)

    const paidCount    = (appointments as AptRow[]).filter((a: AptRow) => a.paymentStatus === 'PAID').length
    const pendingCount = (appointments as AptRow[]).filter((a: AptRow) => a.paymentStatus === 'PENDING').length

    return NextResponse.json({
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        appointmentCount: appointments.length,
        paidCount,
        pendingCount,
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error calculando contabilidad:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
