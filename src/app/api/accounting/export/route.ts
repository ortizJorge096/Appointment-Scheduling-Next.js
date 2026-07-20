// src/app/api/accounting/export/route.ts
// GET /api/accounting/export?dateFrom&dateTo → the period's financial statement as
// CSV (admin): a summary block + a chronological cashbook of every movement (income
// from appointments and quick sales, plus expenses). Reuses the SAME money rules as
// GET /api/accounting (src/lib/accounting) so the CSV totals reconcile with the
// on-screen KPIs. No client PII — this is the accountant's artifact — and it is a
// financial export, so it is permission-gated AND audited.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { appointmentIncome, appointmentBalance } from '@/lib/accounting'
import { PAYMENT_METHOD_LABEL, EXPENSE_CATEGORY_LABEL } from '@/lib/labels'
import { formatInTimeZone } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 10000

// RFC-4180 CSV escaping: wrap in quotes, double internal quotes.
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}
const row = (cells: unknown[]) => cells.map(csvCell).join(',')

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
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
  const hasRange = Object.keys(dateFilter).length > 0

  try {
    // Same population as GET /api/accounting: appointments are CONFIRMED/COMPLETED in
    // the period; expenses exclude soft-deleted rows; quick sales are all in-period.
    const [appointments, expenses, quickSales] = await Promise.all([
      prisma.appointment.findMany({
        where: { date: hasRange ? dateFilter : undefined, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        orderBy: { date: 'asc' },
        take: MAX_ROWS,
        select: {
          date: true, paymentStatus: true, paymentMethod: true, amountPaid: true, precioFinal: true,
          // Discounts (order-level and per line) and extras all move the charge —
          // without these the total is the raw catalog sum. See src/lib/accounting.
          descuentoTipo: true, descuentoValor: true,
          extras:   { select: { amount: true, appointmentServiceId: true } },
          service:  { select: { name: true, price: true } },
          services: {
            select: {
              price: true, descuentoTipo: true, descuentoValor: true,
              extras:  { select: { amount: true } },
              service: { select: { name: true } },
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: { deletedAt: null, date: hasRange ? dateFilter : undefined },
        orderBy: { date: 'asc' },
        take: MAX_ROWS,
        select: { date: true, description: true, category: true, amount: true, notes: true },
      }),
      prisma.quickSale.findMany({
        where: { date: hasRange ? dateFilter : undefined },
        orderBy: { date: 'asc' },
        take: MAX_ROWS,
        select: { date: true, description: true, amount: true, paymentMethod: true },
      }),
    ])

    // ── Movements (one row per cash movement), income via the shared rule ──
    type Movement = { date: Date; tipo: string; concepto: string; detalle: string; income: number; expense: number }
    const movements: Movement[] = []

    for (const a of appointments) {
      const income = appointmentIncome(a)
      // A charge that collected nothing (PENDING/WAIVED) is not a cash movement; its
      // outstanding balance shows under "Por cobrar" in the summary, not here.
      if (income <= 0) continue
      const concepto = a.services && a.services.length > 1
        ? a.services.map((s) => s.service.name).join(' + ')
        : a.service.name
      movements.push({
        date: a.date, tipo: 'Cita', concepto,
        detalle: a.paymentMethod ? (PAYMENT_METHOD_LABEL[a.paymentMethod] ?? a.paymentMethod) : 'Sin registrar',
        income, expense: 0,
      })
    }
    for (const q of quickSales) {
      movements.push({
        date: q.date, tipo: 'Venta rápida', concepto: q.description,
        detalle: q.paymentMethod ? (PAYMENT_METHOD_LABEL[q.paymentMethod] ?? q.paymentMethod) : 'Sin registrar',
        income: q.amount, expense: 0,
      })
    }
    for (const e of expenses) {
      const cat = EXPENSE_CATEGORY_LABEL[e.category] ?? e.category
      movements.push({
        date: e.date, tipo: 'Gasto', concepto: e.description,
        // Fold the expense note into Detalle so it isn't lost (the old expenses-only
        // export carried it), without adding a column that'd be blank on income rows.
        detalle: e.notes ? `${cat} · ${e.notes}` : cat,
        income: 0, expense: e.amount,
      })
    }
    movements.sort((a, b) => a.date.getTime() - b.date.getTime())

    // ── Summary — reconciles with GET /api/accounting (same rules, same population) ──
    const totalIncome    = movements.reduce((s, m) => s + m.income, 0)
    const totalExpenses  = movements.reduce((s, m) => s + m.expense, 0)
    const quickSaleTotal = quickSales.reduce((s, q) => s + q.amount, 0)
    const netProfit      = totalIncome - totalExpenses
    const marginPct      = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0
    let receivable = 0, receivableCount = 0
    for (const a of appointments) {
      const bal = appointmentBalance(a)
      if (bal > 0) { receivable += bal; receivableCount += 1 }
    }

    // ── Assemble the CSV (summary block, then the cashbook) ──
    const money  = (n: number) => String(n) // raw integers so Excel can sum
    const period = `${dateFrom ?? '—'} a ${dateTo ?? '—'}`
    const lines: string[] = [
      row([`Contabilidad — ${period}`]),
      '',
      row(['RESUMEN']),
      row(['Ingresos', money(totalIncome)]),
      row(['  de los cuales ventas rápidas', money(quickSaleTotal)]),
      row(['Gastos', money(totalExpenses)]),
      row(['Utilidad neta', money(netProfit)]),
      row(['Margen', `${marginPct}%`]),
      row(['Por cobrar', money(receivable)]),
      row(['Citas con saldo', String(receivableCount)]),
      '',
      row(['MOVIMIENTOS']),
      row(['Fecha', 'Tipo', 'Concepto', 'Detalle', 'Ingreso', 'Gasto']),
      ...movements.map((m) => row([
        m.date.toISOString().slice(0, 10), m.tipo, m.concepto, m.detalle,
        m.income ? money(m.income) : '', m.expense ? money(m.expense) : '',
      ])),
      row(['TOTALES', '', '', '', money(totalIncome), money(totalExpenses)]),
    ]

    // Record the financial export (fire-and-forget; never blocks the download).
    audit({
      action: 'EXPORT', entity: 'EXPENSE', entityId: 'accounting', actorType: 'ADMIN',
      userEmail: admin.email, ip: getClientIp(request), userAgent: getUserAgent(request),
      description: `${admin.email || 'Admin'} exportó la contabilidad del período (${movements.length} movimientos)`,
      metadata: { movements: movements.length, totalIncome, totalExpenses, dateFrom, dateTo },
    })

    // BOM so Excel opens the UTF-8 accents/ñ correctly.
    const csv      = '﻿' + lines.join('\r\n')
    const today    = formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd')
    const filename = `contabilidad-${dateFrom ?? today}_${dateTo ?? today}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error exportando contabilidad:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
