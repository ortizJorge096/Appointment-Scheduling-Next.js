// src/components/admin/DashboardStats.tsx
import { StatCard } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'

interface Props {
  todayCount:    number
  weekCount:     number
  pendingCount:  number
  todayRevenue:  number
  totalCompleted: number
}

export function DashboardStats({ todayCount, weekCount, pendingCount, todayRevenue, totalCompleted }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
      <StatCard label="Citas hoy"         value={todayCount}               />
      <StatCard label="Esta semana"        value={weekCount}                />
      <StatCard label="Pendientes"         value={pendingCount}  accent={pendingCount > 0} />
      <StatCard label="Ingreso hoy"        value={formatPrice(todayRevenue)} />
      <StatCard label="Total completadas"  value={totalCompleted}           />
    </div>
  )
}
