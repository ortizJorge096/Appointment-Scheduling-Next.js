// src/app/api/appointments/export/route.ts
// GET /api/appointments/export → download the appointments list as CSV (admin),
// honoring the SAME filters as GET /api/appointments (reuses the query builder).
// Two column profiles: 'full' (with client contact / PII) or 'accounting' (no
// contact — safe to hand to an accountant). Exporting client PII + payment data
// is a data-protection-relevant event, so it is permission-gated AND audited.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { buildAppointmentListQuery } from '@/lib/appointmentList'
import { appointmentCharge, type AppointmentMoney } from '@/lib/accounting'
import type { DiscountKind } from '@/lib/discount'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { STATUS_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL, ORIGIN_LABEL } from '@/lib/labels'
import { formatInTimeZone } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 10000

// RFC-4180 CSV escaping: wrap in quotes, double internal quotes.
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

// Extends the shared money shape so the exported "Total" is the SAME charge the
// accounting screens use (discounts + extras included), not a raw catalog sum.
type Row = Omit<AppointmentMoney, 'services'> & {
  date: Date; startTime: string; clientName: string; clientPhone: string; clientEmail: string | null
  status: string; paymentMethod: string | null; origin: string
  service: { name: string; price: number }
  services: Array<{
    price: number
    descuentoTipo: DiscountKind | null
    descuentoValor: number | null
    extras: Array<{ amount: number }>
    service: { name: string }
  }>
}

function serviceNames(a: Row): string {
  return a.services && a.services.length > 1 ? a.services.map((s) => s.service.name).join(' + ') : a.service.name
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'citas:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const num = (v: string | null) => {
    if (v == null || v.trim() === '') return undefined
    const n = Number(v); return Number.isFinite(n) ? n : undefined
  }
  const today   = formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd')
  const sort    = searchParams.get('sort') ?? undefined
  const columns = searchParams.get('columns') === 'accounting' ? 'accounting' : 'full'

  const { where, orderBy } = buildAppointmentListQuery({
    status:     searchParams.get('status')     ?? undefined,
    scope:      searchParams.get('scope')      ?? undefined,
    origin:     searchParams.get('origin')     ?? undefined,
    payment:       searchParams.get('payment')       ?? undefined,
    paymentMethod: searchParams.get('paymentMethod') ?? undefined,
    search:     searchParams.get('search')     ?? undefined,
    serviceId:  searchParams.get('serviceId')  ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    amountMin:  num(searchParams.get('amountMin')),
    amountMax:  num(searchParams.get('amountMax')),
    dateFrom:   searchParams.get('dateFrom')   ?? undefined,
    dateTo:     searchParams.get('dateTo')     ?? undefined,
    sort, sortExplicit: !!sort, today,
  })

  const appts = await prisma.appointment.findMany({
    where, orderBy, take: MAX_ROWS,
    select: {
      date: true, startTime: true, clientName: true, clientPhone: true, clientEmail: true,
      status: true, paymentStatus: true, paymentMethod: true, amountPaid: true, precioFinal: true, origin: true,
      // Discounts + extras move the charge — see src/lib/accounting.
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
  }) as unknown as Row[]

  const money = (n: number | null) => (n == null ? '' : String(n)) // raw numbers so Excel can sum

  const header = columns === 'accounting'
    ? ['Fecha', 'Servicios', 'Estado', 'Pago', 'Método', 'Total', 'Pagado']
    : ['Fecha', 'Hora', 'Cliente', 'Teléfono', 'Email', 'Servicios', 'Estado', 'Pago', 'Método', 'Total', 'Pagado', 'Origen']

  const rows = appts.map((a) => {
    const fecha  = a.date.toISOString().slice(0, 10)
    const estado = STATUS_LABEL[a.status] ?? a.status
    const pago   = PAYMENT_STATUS_LABEL[a.paymentStatus] ?? a.paymentStatus
    const metodo = a.paymentMethod ? (PAYMENT_METHOD_LABEL[a.paymentMethod] ?? a.paymentMethod) : ''
    const total  = a.precioFinal ?? appointmentCharge(a)
    const cells = columns === 'accounting'
      ? [fecha, serviceNames(a), estado, pago, metodo, total, money(a.amountPaid)]
      : [fecha, a.startTime, a.clientName, a.clientPhone, a.clientEmail ?? '', serviceNames(a), estado, pago, metodo, total, money(a.amountPaid), ORIGIN_LABEL[a.origin] ?? a.origin]
    return cells.map(csvCell).join(',')
  })

  // Record who exported client PII + payments, with what filters, how many rows
  // and which profile (fire-and-forget; never blocks the download).
  audit({
    action:    'EXPORT',
    entity:    'APPOINTMENT',
    entityId:  'appointments',
    actorType: 'ADMIN',
    userEmail: admin.email,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description: `${admin.email || 'Admin'} exportó citas (${appts.length} filas, perfil ${columns === 'accounting' ? 'contable' : 'completo'})`,
    metadata:  { rowCount: appts.length, columns, filters: Object.fromEntries(searchParams) },
  })

  // BOM so Excel opens the UTF-8 accents/ñ correctly.
  const csv = '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n')
  const filename = `citas-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
