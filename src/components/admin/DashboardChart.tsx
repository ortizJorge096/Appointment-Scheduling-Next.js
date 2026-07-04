'use client'
// src/components/admin/DashboardChart.tsx
// Period bar chart for the admin dashboard, with a citas/ingresos toggle and a
// period-over-period trend. Client component (the Server dashboard can't hold
// the toggle state). Bars keep the CSS/div style used across the app.

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'

interface Day {
  key:     string
  label:   string
  weekday: string
  count:   number
  revenue: number
}

interface Props {
  days:        Day[]
  periodDays:  number
  prevCount:   number
  prevRevenue: number
}

export function DashboardChart({ days, periodDays, prevCount, prevRevenue }: Props) {
  const [metric, setMetric] = useState<'citas' | 'ingresos'>('citas')
  const isRevenue = metric === 'ingresos'

  const values = days.map((d) => (isRevenue ? d.revenue : d.count))
  const max    = Math.max(1, ...values)
  const total  = values.reduce((s, v) => s + v, 0)
  const prev   = isRevenue ? prevRevenue : prevCount
  const pct    = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null
  const totalLabel = isRevenue ? formatPrice(total) : `${total} citas`

  const tab = (m: 'citas' | 'ingresos', label: string) => (
    <button type="button" onClick={() => setMetric(m)}
      className={`px-3 py-1 transition-colors ${metric === m ? 'bg-gold text-white' : 'text-ink-muted hover:bg-beige/40'}`}>
      {label}
    </button>
  )

  return (
    <div className="bg-white rounded-xl border border-beige-dark p-5 sm:p-6 lg:col-span-2">
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-xl text-ink">{isRevenue ? 'Ingresos' : 'Citas'} · últimos {periodDays} días</h2>
          <p className="text-xs mt-0.5">
            <b className="font-serif text-gold-dark text-base">{totalLabel}</b>
            {pct !== null && (
              <span className={`ml-2 ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}% <span className="text-ink-muted">vs. período anterior</span>
              </span>
            )}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-beige-dark overflow-hidden text-xs font-semibold">
          {tab('citas', 'Citas')}
          {tab('ingresos', 'Ingresos')}
        </div>
      </div>

      {/* min-w forces horizontal scroll on mobile instead of squashing the bars;
          sm:min-w-0 lets it size to the card normally once there's enough room. */}
      <div className="overflow-x-auto -mx-1">
        <div className="flex items-end gap-1.5 min-w-[480px] sm:min-w-0 px-1">
          {days.map((d, i) => (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full h-40 flex items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-gold to-gold-light
                             min-h-[2px] transition-all duration-300 hover:brightness-110"
                  style={{ height: `${Math.round((values[i] / max) * 100)}%` }}
                  title={`${d.weekday} ${d.label}: ${isRevenue ? formatPrice(d.revenue) : `${d.count} cita(s)`}`}
                />
              </div>
              <span className="text-[9px] text-ink-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
