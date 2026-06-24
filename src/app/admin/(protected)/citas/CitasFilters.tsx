'use client'
// src/app/admin/(protected)/citas/CitasFilters.tsx
// Client Component — handles interactive date filters

import { useRouter } from 'next/navigation'
import { STATUS_LABEL as APPOINTMENT_STATUS_LABEL } from '@/lib/appointmentStatus'

interface Props {
  status?:   string
  dateFrom?: string
  dateTo?:   string
}

// This filter strip doesn't offer a NO_SHOW button, but does need "Todas" —
// derive from the canonical map instead of redefining the other four by hand.
const STATUS_LABEL: Record<string, string> = { ALL: 'Todas', ...APPOINTMENT_STATUS_LABEL }

export default function CitasFilters({ status, dateFrom, dateTo }: Props) {
  const router = useRouter()

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      ...(status   && status !== 'ALL' ? { status }   : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo   ? { dateTo }   : {}),
      ...overrides,
    })
    router.push(`/admin/citas?${params}`)
  }

  return (
    <div className="bg-white rounded-xl border border-beige-dark p-3 sm:p-4 mb-6 flex flex-wrap gap-3 items-end">

      {/* Status */}
      <div>
        <label className="form-label text-[10px]">Estado</label>
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((s) => (
            <button key={s} type="button"
              onClick={() => buildUrl({ status: s })}
              className={`px-3 py-1.5 text-xs border rounded-lg transition-colors
                ${(status ?? 'ALL') === s
                  ? 'bg-ink border-ink text-white'
                  : 'bg-white border-beige-dark text-ink-muted hover:border-gold'}`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* From */}
      <div>
        <label className="form-label text-[10px]">Desde</label>
        <input type="date" defaultValue={dateFrom}
          className="input-field text-sm py-1.5 w-36"
          onChange={(e) => buildUrl({ dateFrom: e.target.value })} />
      </div>

      {/* To */}
      <div>
        <label className="form-label text-[10px]">Hasta</label>
        <input type="date" defaultValue={dateTo}
          className="input-field text-sm py-1.5 w-36"
          onChange={(e) => buildUrl({ dateTo: e.target.value })} />
      </div>

      {/* Clear */}
      {(status && status !== 'ALL' || dateFrom || dateTo) && (
        <button type="button"
          onClick={() => router.push('/admin/citas')}
          className="text-xs text-ink-muted hover:text-gold transition-colors self-end pb-1.5">
          Limpiar ×
        </button>
      )}
    </div>
  )
}
