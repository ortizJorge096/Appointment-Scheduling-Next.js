// src/app/admin/(protected)/page.tsx
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { StatCard } from '@/components/ui/Card'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
}
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'badge-pending', CONFIRMED: 'badge-confirmed',
  COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled', NO_SHOW: 'badge-no_show',
}

// Order used for the status-distribution bars
const STATUS_ORDER = ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'] as const

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

const PERIOD_DAYS = 14

export default async function DashboardPage() {
  const now        = new Date()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 })
  const periodStart = startOfDay(subDays(now, PERIOD_DAYS - 1))

  const [todayAppointments, weekCount, pendingCount, totalCompleted, periodAppts, topClients] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      include: { service: { select: { name: true, price: true, durationMinutes: true } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.appointment.count({
      where: { date: { gte: weekStart, lte: weekEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    prisma.appointment.count({ where: { status: 'COMPLETED' } }),
    // Last PERIOD_DAYS for charts (cancelled excluded)
    prisma.appointment.findMany({
      where: { date: { gte: periodStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      select: { date: true, status: true, service: { select: { price: true } } },
    }),
    // Most frequent clients (by appointment count)
    prisma.client.findMany({
      orderBy: { appointments: { _count: 'desc' } },
      take: 5,
      include: { _count: { select: { appointments: true } } },
    }),
  ])

  const todayRevenue = todayAppointments
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + a.service.price, 0)

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
    if (a.status === 'COMPLETED') bucket.revenue += a.service.price
  }
  const maxCount      = Math.max(1, ...days.map((d) => d.count))
  const periodRevenue = days.reduce((s, d) => s + d.revenue, 0)
  const periodTotal   = periodAppts.length

  // ── Status distribution over the period ──
  const statusCounts = periodAppts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const stats = [
    { label: 'Citas hoy',         value: todayAppointments.length,  accent: false },
    { label: 'Esta semana',        value: weekCount,                 accent: false },
    { label: 'Pendientes',         value: pendingCount,              accent: pendingCount > 0 },
    { label: 'Ingreso hoy',        value: formatPrice(todayRevenue), accent: false },
    { label: 'Total completadas',  value: totalCompleted,            accent: false },
  ]

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">
          {format(now, "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="font-serif text-3xl text-ink font-light">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Bar chart — appointments per day */}
        <div className="card-premium p-6 lg:col-span-2">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
            <h2 className="font-serif text-xl text-ink">Citas · últimos {PERIOD_DAYS} días</h2>
            <span className="text-xs text-ink-muted">
              Ingresos del período:{' '}
              <b className="font-serif text-gold-dark text-base">{formatPrice(periodRevenue)}</b>
            </span>
          </div>
          <div className="flex items-end gap-1.5">
            {days.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full h-40 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-gold to-gold-light
                               min-h-[2px] transition-all duration-300 hover:brightness-110"
                    style={{ height: `${Math.round((d.count / maxCount) * 100)}%` }}
                    title={`${d.weekday} ${d.label}: ${d.count} cita(s) · ${formatPrice(d.revenue)}`}
                  />
                </div>
                <span className="text-[9px] text-ink-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status distribution */}
        <div className="card-premium p-6">
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
                      <span className="text-ink-mid">{STATUS_LABEL[st]}</span>
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
      <div className="card-premium overflow-hidden">
        <div className="px-6 py-4 border-b border-beige-dark flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink font-light">Citas de hoy</h2>
          <Link href="/admin/citas" className="text-xs text-gold hover:underline">Ver todas →</Link>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-muted text-sm">
            No hay citas agendadas para hoy.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {todayAppointments.map((appt) => (
              <Link key={appt.id} href={`/admin/citas/${appt.id}`}
                className="flex items-center justify-between px-6 py-4
                           hover:bg-beige transition-colors group">
                <div className="flex items-center gap-6">
                  <div className="text-center w-14">
                    <p className="font-serif text-lg text-ink">{appt.startTime}</p>
                    <p className="text-[10px] text-ink-muted">{appt.endTime}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{appt.clientName}</p>
                    <p className="text-xs text-ink-muted">{appt.service.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gold hidden sm:block">{formatPrice(appt.service.price)}</p>
                  <span className={STATUS_CLASS[appt.status]}>{STATUS_LABEL[appt.status]}</span>
                  <span className="text-gold-light group-hover:text-gold transition-colors text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Frequent clients */}
      <div className="card-premium overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-beige-dark flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink font-light">Clientas frecuentes</h2>
          <Link href="/admin/clientes" className="text-xs text-gold hover:underline">Ver todas →</Link>
        </div>
        {topClients.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-muted text-sm">
            Aún no hay clientas registradas.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {topClients.map((c) => (
              <Link key={c.id} href={`/admin/clientes/${c.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-beige transition-colors group">
                <div className="flex items-center gap-4 min-w-0">
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
