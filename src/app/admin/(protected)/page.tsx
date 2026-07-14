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
import { STATUS_LABEL } from '@/lib/appointmentStatus'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

// Order used for the status-distribution bars
const STATUS_ORDER = ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'] as const

const PERIOD_DAYS = 14

// Minimal shape shared by every priced-appointment query below.
type Priced = { service: { price: number }; services?: { price: number }[] }

// Total price of an appointment (multi-service aware, using snapshot prices).
function priceOf(a: Priced): number {
  if (a.services && a.services.length > 1) return a.services.reduce((s, x) => s + x.price, 0)
  return a.service.price
}

// Revenue from the COMPLETED appointments in a list.
function completedRevenue(list: Array<Priced & { status: string }>): number {
  return list.filter((a) => a.status === 'COMPLETED').reduce((s, a) => s + priceOf(a), 0)
}

// Period-over-period trend chip. A rise is good by default (revenue, volume);
// pass `invert` where a rise is bad. No baseline → a muted placeholder.
function Trend({ current, previous, label, invert = false }: { current: number; previous: number; label: string; invert?: boolean }) {
  if (previous <= 0) return <span className="text-ink-muted">— sin dato previo</span>
  const pct   = Math.round(((current - previous) / previous) * 100)
  const dir   = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const good  = dir === 'flat' ? null : invert ? dir === 'down' : dir === 'up'
  const color = good === null ? 'text-ink-muted' : good ? 'text-green-600' : 'text-red-500'
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'
  return <span className={color}>{arrow} {Math.abs(pct)}% <span className="text-ink-muted">{label}</span></span>
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

  const [
    todayAppointments, weekCount, prevWeekCount, pendingCount,
    periodAppts, prevPeriodAppts, yesterdayAppts, receivableAppts, topClients,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      include: {
        service: { select: { name: true, price: true, durationMinutes: true } },
        services: { include: { service: { select: { name: true, price: true } } } },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.appointment.count({ where: { date: { gte: weekStart, lte: weekEnd }, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { date: { gte: prevWeekStart, lte: prevWeekEnd }, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    // Last PERIOD_DAYS for the chart (cancelled excluded)
    prisma.appointment.findMany({
      where: { date: { gte: periodStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      select: { date: true, status: true, service: { select: { price: true } }, services: { select: { price: true } } },
    }),
    // The PERIOD_DAYS before that, for the period-over-period trend
    prisma.appointment.findMany({
      where: { date: { gte: prevPeriodStart, lte: prevPeriodEnd }, status: { not: 'CANCELLED' } },
      select: { status: true, service: { select: { price: true } }, services: { select: { price: true } } },
    }),
    // Yesterday's completed appointments, to trend today's revenue
    prisma.appointment.findMany({
      where: { date: { gte: ydayStart, lte: ydayEnd }, status: 'COMPLETED' },
      select: { status: true, service: { select: { price: true } }, services: { select: { price: true } } },
    }),
    // Outstanding: real appointments not fully paid → money still owed
    prisma.appointment.findMany({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] }, paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
      select: { paymentStatus: true, amountPaid: true, precioFinal: true, service: { select: { price: true } }, services: { select: { price: true } } },
    }),
    // Most frequent clients (by appointment count)
    prisma.client.findMany({
      orderBy: { appointments: { _count: 'desc' } },
      take: 5,
      include: { _count: { select: { appointments: true } } },
    }),
  ])

  const todayRevenue     = completedRevenue(todayAppointments as unknown as Array<Priced & { status: string }>)
  const yesterdayRevenue = completedRevenue(yesterdayAppts as Array<Priced & { status: string }>)

  // Receivable: PENDING owes the full expected value; PARTIAL owes the remainder.
  let receivable = 0
  for (const a of receivableAppts) {
    const expected = a.precioFinal ?? priceOf(a)
    receivable += a.paymentStatus === 'PARTIAL' ? Math.max(0, expected - (a.amountPaid ?? 0)) : expected
  }

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
    if (a.status === 'COMPLETED') bucket.revenue += priceOf(a)
  }
  const periodRevenue     = days.reduce((s, d) => s + d.revenue, 0)
  const periodTotal       = periodAppts.length
  const prevPeriodRevenue = completedRevenue(prevPeriodAppts as Array<Priced & { status: string }>)
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
        <StatCard label="Citas hoy" value={todayAppointments.length} />
        <StatCard label="Ingreso hoy" value={formatPrice(todayRevenue)}
          hint={<Trend current={todayRevenue} previous={yesterdayRevenue} label="vs. ayer" />} />
        <StatCard label="Esta semana" value={weekCount}
          hint={<Trend current={weekCount} previous={prevWeekCount} label="vs. sem. pasada" />} />
        <Link href="/admin/contabilidad" className="block h-full">
          <StatCard label="Por cobrar" value={formatPrice(receivable)} accent className="h-full" />
        </Link>
        <StatCard label="Pendientes" value={pendingCount} accent={pendingCount > 0}
          className="col-span-2 lg:col-span-1" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Bar chart — appointments/revenue per day, toggleable */}
        <DashboardChart days={days} periodDays={PERIOD_DAYS} prevCount={prevPeriodTotal} prevRevenue={prevPeriodRevenue} />

        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-beige-dark p-5 sm:p-6">
          <h2 className="font-serif text-xl text-ink mb-5">Distribución ({periodTotal})</h2>
          {periodTotal === 0 ? (
            <p className="text-sm text-ink-muted">Sin datos en el período.</p>
          ) : (
            <div className="space-y-4">
              {STATUS_ORDER.map((st) => {
                const n   = statusCounts[st] ?? 0
                const pct = periodTotal ? Math.round((n / periodTotal) * 100) : 0
                return (
                  <div key={st}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-ink-muted">{STATUS_LABEL[st]}</span>
                      <span className="text-ink-muted">{n} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-beige overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
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
          <Link href="/admin/citas" className="text-xs text-gold hover:underline">Ver todas →</Link>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="px-5 sm:px-6 py-12 text-center text-ink-muted text-sm">
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
                    <p className="text-[10px] text-ink-muted">{appt.endTime}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{appt.clientName}</p>
                    <p className="text-xs text-ink-muted">
                      {appt.services && appt.services.length > 1
                        ? appt.services.map((s) => s.service.name).join(' + ')
                        : appt.service.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gold hidden sm:block">
                    {formatPrice(
                      appt.services && appt.services.length > 1
                        ? appt.services.reduce((sum, s) => sum + s.price, 0)
                        : appt.service.price
                    )}
                  </p>
                  <StatusBadge status={appt.status} />
                  <span className="text-gold-light group-hover:text-gold transition-colors text-lg">›</span>
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
          <Link href="/admin/clientes" className="text-xs text-gold hover:underline">Ver todos →</Link>
        </div>
        {topClients.length === 0 ? (
          <div className="px-5 sm:px-6 py-12 text-center text-ink-muted text-sm">
            Aún no hay clientes registrados.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {topClients.map((c) => (
              <Link key={c.id} href={`/admin/clientes/${c.id}`}
                className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-beige transition-colors group">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-gold-pale text-gold-dark flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                    <p className="text-xs text-ink-muted truncate">{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-medium text-gold-dark bg-gold/10 px-2.5 py-0.5 rounded-full">
                    {c._count.appointments} cita{c._count.appointments === 1 ? '' : 's'}
                  </span>
                  <span className="text-gold-light group-hover:text-gold transition-colors text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
