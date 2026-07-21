// src/app/admin/(protected)/page.tsx
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/authz'
import Link from 'next/link'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { StatCard } from '@/components/ui/Card'
import { DashboardChart } from '@/components/admin/DashboardChart'
import { formatPrice } from '@/lib/utils'
import { appointmentIncome, appointmentBalance, appointmentCharge, type AppointmentMoney } from '@/lib/accounting'
import { STATUS_LABEL } from '@/lib/appointmentStatus'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

// Order used for the status-distribution bars
const STATUS_ORDER = ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'] as const

// Semantic bar colour per status so the distribution reads at a glance
// (instead of every bar being the same gold).
const STATUS_BAR: Record<string, string> = {
  CONFIRMED: 'from-blue-300 to-blue-500',
  PENDING:   'from-amber-300 to-amber-500',
  COMPLETED: 'from-green-400 to-green-600',
  NO_SHOW:   'from-red-300 to-red-500',
}

const PERIOD_DAYS = 14

// Collected income from a list of appointments, using the SAME rule as Contabilidad
// (appointmentIncome in src/lib/accounting) over the accounting population
// (CONFIRMED/COMPLETED) — so the dashboard's money matches the accounting screen
// (a COMPLETED-but-unpaid or courtesy appointment is NOT revenue, a discount counts
// at its snapshot, etc.). Walk-in quick sales are added on top by the caller.
function incomeOf(list: Array<AppointmentMoney & { status: string }>): number {
  return list.reduce(
    (s, a) => (a.status === 'CONFIRMED' || a.status === 'COMPLETED' ? s + appointmentIncome(a) : s),
    0,
  )
}

// Period-over-period trend chip. A rise is good by default (revenue, volume);
// pass `invert` where a rise is bad. No baseline → a muted placeholder.
function Trend({ current, previous, label, invert = false }: { current: number; previous: number; label: string; invert?: boolean }) {
  if (previous <= 0) return <span className="text-ink-muted-deep">— sin dato previo</span>
  const pct   = Math.round(((current - previous) / previous) * 100)
  const dir   = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const good  = dir === 'flat' ? null : invert ? dir === 'down' : dir === 'up'
  const color = good === null ? 'text-ink-muted-deep' : good ? 'text-green-700' : 'text-red-700'
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'
  return <span className={color}>{arrow} {Math.abs(pct)}% <span className="text-ink-muted-deep">{label}</span></span>
}

export default async function DashboardPage() {
  if (!(await requirePermission('metricas:ver'))) redirect('/admin/no-autorizado')

  const now        = new Date()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const ydayStart  = startOfDay(subDays(now, 1))
  const ydayEnd    = endOfDay(subDays(now, 1))
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 })
  const prevWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
  const prevWeekEnd   = endOfWeek(subDays(now, 7),   { weekStartsOn: 1 })
  const periodStart     = startOfDay(subDays(now, PERIOD_DAYS - 1))
  const prevPeriodStart = startOfDay(subDays(now, PERIOD_DAYS * 2 - 1))
  const prevPeriodEnd   = endOfDay(subDays(now, PERIOD_DAYS))

  // yyyy-MM-dd keys for the stat-card deep links. Same formatting the day buckets
  // use, and the same the citas/contabilidad date filters parse back.
  const todayKey    = format(now,       'yyyy-MM-dd')
  const weekFromKey = format(weekStart, 'yyyy-MM-dd')
  const weekToKey   = format(weekEnd,   'yyyy-MM-dd')

  const [
    todayAppointments, weekCount, prevWeekCount, pendingCount,
    periodAppts, prevPeriodAppts, yesterdayAppts, receivableAppts, topClients,
    periodQuickSales, prevPeriodQuickSales,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      include: {
        // `include` already returns the appointment scalars (descuentoTipo/Valor), but
        // the extras relations must be asked for explicitly or the charge ignores them.
        extras:  { select: { amount: true, appointmentServiceId: true } },
        service: { select: { name: true, price: true, durationMinutes: true } },
        services: {
          include: {
            service: { select: { name: true, price: true } },
            extras:  { select: { amount: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.appointment.count({ where: { date: { gte: weekStart, lte: weekEnd }, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { date: { gte: prevWeekStart, lte: prevWeekEnd }, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    // Last PERIOD_DAYS for the chart (cancelled excluded). Money fields so each
    // day's revenue can use the same income rule as Contabilidad.
    prisma.appointment.findMany({
      where: { date: { gte: periodStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      select: { date: true, status: true, paymentStatus: true, amountPaid: true, precioFinal: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true, appointmentServiceId: true } }, service: { select: { price: true } }, services: { select: { price: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true } } } } },
    }),
    // The PERIOD_DAYS before that, for the period-over-period trend
    prisma.appointment.findMany({
      where: { date: { gte: prevPeriodStart, lte: prevPeriodEnd }, status: { not: 'CANCELLED' } },
      select: { status: true, paymentStatus: true, amountPaid: true, precioFinal: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true, appointmentServiceId: true } }, service: { select: { price: true } }, services: { select: { price: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true } } } } },
    }),
    // Yesterday's income, to trend today's revenue (same population as accounting).
    prisma.appointment.findMany({
      where: { date: { gte: ydayStart, lte: ydayEnd }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: { status: true, paymentStatus: true, amountPaid: true, precioFinal: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true, appointmentServiceId: true } }, service: { select: { price: true } }, services: { select: { price: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true } } } } },
    }),
    // Outstanding: real appointments not fully paid → money still owed
    prisma.appointment.findMany({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] }, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
      select: { paymentStatus: true, amountPaid: true, precioFinal: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true, appointmentServiceId: true } }, service: { select: { price: true } }, services: { select: { price: true, descuentoTipo: true, descuentoValor: true, extras: { select: { amount: true } } } } },
    }),
    // Most frequent clients (by appointment count)
    prisma.client.findMany({
      orderBy: { appointments: { _count: 'desc' } },
      take: 5,
      include: { _count: { select: { appointments: true } } },
    }),
    // Walk-in quick sales for the chart period (bucketed by day below) and a summed
    // total for the previous period — counter income, as Contabilidad counts it.
    prisma.quickSale.findMany({
      where: { date: { gte: periodStart, lte: todayEnd } },
      select: { date: true, amount: true },
    }),
    prisma.quickSale.aggregate({
      where: { date: { gte: prevPeriodStart, lte: prevPeriodEnd } },
      _sum: { amount: true },
    }),
  ])

  // Quick-sale income bucketed by day (today and yesterday fall inside the period).
  const qsByDay = new Map<string, number>()
  for (const q of periodQuickSales) {
    const k = format(q.date, 'yyyy-MM-dd')
    qsByDay.set(k, (qsByDay.get(k) ?? 0) + q.amount)
  }
  const todayQS      = qsByDay.get(format(now, 'yyyy-MM-dd')) ?? 0
  const yesterdayQS  = qsByDay.get(format(subDays(now, 1), 'yyyy-MM-dd')) ?? 0
  const prevPeriodQS = prevPeriodQuickSales._sum.amount ?? 0

  // Revenue uses the same income rule as Contabilidad + walk-in sales, so the two
  // screens never disagree on "how much did we make".
  const todayRevenue     = incomeOf(todayAppointments as unknown as Array<AppointmentMoney & { status: string }>) + todayQS
  const yesterdayRevenue = incomeOf(yesterdayAppts as Array<AppointmentMoney & { status: string }>) + yesterdayQS

  // Receivable = money still owed (same rule as accounting's appointmentBalance).
  let receivable = 0
  for (const a of receivableAppts) receivable += appointmentBalance(a)

  // ── Build per-day buckets for the bar chart ──
  const days = Array.from({ length: PERIOD_DAYS }, (_, i) => {
    const d = subDays(now, PERIOD_DAYS - 1 - i)
    return {
      key:     format(d, 'yyyy-MM-dd'),
      label:   format(d, 'd'),
      weekday: format(d, 'eee', { locale: es }),
      count:   0,
      revenue: 0,
    }
  })
  const byKey = new Map(days.map((d) => [d.key, d]))
  for (const a of periodAppts) {
    const bucket = byKey.get(format(a.date, 'yyyy-MM-dd'))
    if (!bucket) continue
    bucket.count += 1
    if (a.status === 'CONFIRMED' || a.status === 'COMPLETED') bucket.revenue += appointmentIncome(a)
  }
  // Fold walk-in sales into each day's revenue (income, but not appointments — so
  // they lift the revenue bars without inflating the citas count).
  for (const [k, amount] of qsByDay) {
    const bucket = byKey.get(k)
    if (bucket) bucket.revenue += amount
  }
  const periodTotal       = periodAppts.length
  const prevPeriodRevenue = incomeOf(prevPeriodAppts as Array<AppointmentMoney & { status: string }>) + prevPeriodQS
  const prevPeriodTotal   = prevPeriodAppts.length

  // ── Status distribution over the period ──
  const statusCounts = periodAppts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader className="mb-8" eyebrow={format(now, "EEEE d 'de' MMMM", { locale: es })} title="Dashboard" />

      {/* Stats — business metrics with period-over-period context */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Every metric links to the detail that produced it, carrying the same window
            it was computed over. An explicit date range wins over `scope` in the query
            builder, so these don't need one. */}
        <Link href={`/admin/citas?dateFrom=${todayKey}&dateTo=${todayKey}`} className="block h-full">
          <StatCard label="Citas hoy" value={todayAppointments.length} className="h-full" />
        </Link>
        {/* Money → Contabilidad, scoped to today (it reads the range off the URL). */}
        <Link href={`/admin/contabilidad?dateFrom=${todayKey}&dateTo=${todayKey}`} className="block h-full">
          <StatCard label="Ingreso hoy" value={formatPrice(todayRevenue)} className="h-full"
            hint={<Trend current={todayRevenue} previous={yesterdayRevenue} label="vs. ayer" />} />
        </Link>
        <Link href={`/admin/citas?dateFrom=${weekFromKey}&dateTo=${weekToKey}`} className="block h-full">
          <StatCard label="Esta semana" value={weekCount} className="h-full"
            hint={<Trend current={weekCount} previous={prevWeekCount} label="vs. sem. pasada" />} />
        </Link>
        {/* Straight to the appointments that owe money, not to the accounting totals:
            the question this card raises is "which ones?". `scope=all` is required —
            the list defaults to upcoming, and most receivables are already past. */}
        <Link href="/admin/citas?payment=pending&scope=all" className="block h-full">
          <StatCard label="Por cobrar" value={formatPrice(receivable)} accent className="h-full" />
        </Link>
        {/* Same idea as "Por cobrar": the count is only useful if you can act on it.
            `scope=all` because pendingCount has no date filter — an unconfirmed
            booking that already went by still counts, and hiding it would make the
            card and the list disagree. The grid span moves to the Link, which is now
            the grid child. */}
        <Link href="/admin/citas?status=PENDING&scope=all" className="block h-full col-span-2 lg:col-span-1">
          <StatCard label="Pendientes" value={pendingCount} accent={pendingCount > 0} className="h-full" />
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Bar chart — appointments/revenue per day, toggleable */}
        <DashboardChart days={days} periodDays={PERIOD_DAYS} prevCount={prevPeriodTotal} prevRevenue={prevPeriodRevenue} />

        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-beige-dark p-5 sm:p-6">
          <h2 className="font-serif text-xl text-ink mb-5">Distribución ({periodTotal})</h2>
          {periodTotal === 0 ? (
            <p className="text-sm text-ink-muted-deep">Sin datos en el período.</p>
          ) : (
            <div className="space-y-4">
              {STATUS_ORDER.map((st) => {
                const n   = statusCounts[st] ?? 0
                const pct = periodTotal ? Math.round((n / periodTotal) * 100) : 0
                return (
                  <div key={st}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-ink-muted-deep">{STATUS_LABEL[st]}</span>
                      <span className="text-ink-muted-deep">{n} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-beige overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${STATUS_BAR[st] ?? 'from-gold-light to-gold'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Today's appointments */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-beige-dark flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink font-light">Citas de hoy</h2>
          <Link href="/admin/citas" className="text-xs text-gold-deep hover:underline">Ver todas →</Link>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="px-5 sm:px-6 py-12 text-center text-ink-muted-deep text-sm">
            No hay citas agendadas para hoy.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {todayAppointments.map((appt) => (
              <Link key={appt.id} href={`/admin/citas/${appt.id}`}
                className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4
                           hover:bg-beige transition-colors group">
                <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                  <div className="text-center w-12 sm:w-14 shrink-0">
                    <p className="font-serif text-lg text-ink">{appt.startTime}</p>
                    <p className="text-2xs text-ink-muted-deep">{appt.endTime}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{appt.clientName}</p>
                    <p className="text-xs text-ink-muted-deep">
                      {appt.services && appt.services.length > 1
                        ? appt.services.map((s) => s.service.name).join(' + ')
                        : appt.service.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gold-deep hidden sm:block">
                    {/* The charge, not a raw catalog sum: discounts and extras move it. */}
                    {formatPrice(appt.precioFinal ?? appointmentCharge(appt as unknown as AppointmentMoney))}
                  </p>
                  <StatusBadge status={appt.status} />
                  <span aria-hidden="true" className="text-gold-light group-hover:text-gold-deep transition-colors text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Frequent clients */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden mt-6">
        <div className="px-5 sm:px-6 py-4 border-b border-beige-dark flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink font-light">Clientes frecuentes</h2>
          <Link href="/admin/clientes" className="text-xs text-gold-deep hover:underline">Ver todos →</Link>
        </div>
        {topClients.length === 0 ? (
          <div className="px-5 sm:px-6 py-12 text-center text-ink-muted-deep text-sm">
            Aún no hay clientes registrados.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {topClients.map((c) => (
              <Link key={c.id} href={`/admin/clientes/${c.id}`}
                className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-beige transition-colors group">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-gold-pale text-gold-deep flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                    <p className="text-xs text-ink-muted-deep truncate">{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium text-gold-dark bg-gold/10 px-2.5 py-0.5 rounded-full">
                    {c._count.appointments} cita{c._count.appointments === 1 ? '' : 's'}
                  </span>
                  <span aria-hidden="true" className="text-gold-light group-hover:text-gold-deep transition-colors text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
