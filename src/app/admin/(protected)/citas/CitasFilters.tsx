'use client'
// src/app/admin/(protected)/citas/CitasFilters.tsx
// Client Component — maneja los filtros interactivos de fecha

import { useRouter } from 'next/navigation'

interface Props {
  status?:   string
  dateFrom?: string
  dateTo?:   string
}

const STATUS_LABEL: Record<string, string> = {
  ALL: 'Todas', PENDING: 'Pendiente', CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada',
}

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
    <div className="bg-white border border-beige-dark p-4 mb-6 flex flex-wrap gap-3 items-end">

      {/* Estado */}
      <div>
        <label className="form-label text-[10px]">Estado</label>
        <div className="flex gap-1.5 flex-wrap">
          {['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((s) => (
            <button key={s} type="button"
              onClick={() => buildUrl({ status: s })}
              className={`px-3 py-1.5 text-xs border transition-colors
                ${(status ?? 'ALL') === s
                  ? 'bg-ink border-ink text-white'
                  : 'bg-white border-beige-dark text-ink-muted hover:border-gold'}`}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Desde */}
      <div>
        <label className="form-label text-[10px]">Desde</label>
        <input type="date" defaultValue={dateFrom}
          className="input-field text-sm py-1.5 w-36"
          onChange={(e) => buildUrl({ dateFrom: e.target.value })} />
      </div>

      {/* Hasta */}
      <div>
        <label className="form-label text-[10px]">Hasta</label>
        <input type="date" defaultValue={dateTo}
          className="input-field text-sm py-1.5 w-36"
          onChange={(e) => buildUrl({ dateTo: e.target.value })} />
      </div>

      {/* Limpiar */}
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
