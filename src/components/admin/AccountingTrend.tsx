'use client'
// src/components/admin/AccountingTrend.tsx
// Monthly income vs. expenses trend for the accounting page — turns the
// single-period snapshot into a 6-month trajectory. Matches the app's div-bar
// chart idiom (DashboardChart); semantic colours: green income, red expenses,
// and the net profit under each month.

import { formatPrice } from '@/lib/utils'

export interface TrendMonth { month: string; label: string; income: number; expenses: number; profit: number }

export function AccountingTrend({ months }: { months: TrendMonth[] }) {
  const max     = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses]))
  const hasData = months.some((m) => m.income > 0 || m.expenses > 0)

  return (
    <div className="bg-white rounded-xl border border-beige-dark p-5 mb-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-serif text-ink">Tendencia · últimos 6 meses</h2>
        <div className="flex items-center gap-3 text-2xs text-ink-muted-deep">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" aria-hidden="true" /> Ingresos</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400" aria-hidden="true" /> Gastos</span>
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-ink-muted-deep">Sin movimientos en los últimos 6 meses.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <div className="flex items-end gap-3 min-w-[420px] sm:min-w-0 px-1">
            {months.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full h-36 flex items-end justify-center gap-1">
                  <div className="w-1/2 max-w-[24px] rounded-t bg-gradient-to-t from-green-600 to-green-400 min-h-[2px] transition-all hover:brightness-110"
                    style={{ height: `${Math.round((m.income / max) * 100)}%` }}
                    title={`Ingresos: ${formatPrice(m.income)}`} />
                  <div className="w-1/2 max-w-[24px] rounded-t bg-gradient-to-t from-red-500 to-red-300 min-h-[2px] transition-all hover:brightness-110"
                    style={{ height: `${Math.round((m.expenses / max) * 100)}%` }}
                    title={`Gastos: ${formatPrice(m.expenses)}`} />
                </div>
                <span className="text-2xs text-ink-muted-deep capitalize">{m.label}</span>
                <span className={`text-2xs font-medium ${m.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}
                  title={`Utilidad: ${formatPrice(m.profit)}`}>
                  {formatPrice(m.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
