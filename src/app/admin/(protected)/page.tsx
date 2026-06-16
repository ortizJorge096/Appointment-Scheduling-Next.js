// src/app/admin/(protected)/page.tsx
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns'
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

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

export default async function DashboardPage() {
  const now        = new Date()
  const todayStart = startOfDay(now)
  const todayEnd   = endOfDay(now)
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd    = endOfWeek(now,   { weekStartsOn: 1 })

  const [todayAppointments, weekCount, pendingCount, totalCompleted] = await Promise.all([
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
  ])

  const todayRevenue = todayAppointments
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + a.service.price, 0)

  const stats = [
    { label: 'Citas hoy',         value: todayAppointments.length, accent: false },
    { label: 'Esta semana',        value: weekCount,                accent: false },
    { label: 'Pendientes',         value: pendingCount,             accent: pendingCount > 0 },
    { label: 'Ingreso hoy',        value: formatPrice(todayRevenue), accent: false },
    { label: 'Total completadas',  value: totalCompleted,           accent: false },
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </div>

      {/* Citas de hoy */}
      <div className="bg-white border border-beige-dark">
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
    </div>
  )
}
