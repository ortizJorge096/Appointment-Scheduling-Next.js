'use client'
// src/app/admin/(protected)/auditoria/AuditoriaPageClient.tsx
// useSearchParams() requires this to be split out and wrapped in <Suspense> by page.tsx

import { Fragment, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/admin/Pagination'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE'
type AuditEntity = 'APPOINTMENT' | 'CLIENT' | 'EXPENSE' | 'SERVICE' | 'GALLERY' | 'SCHEDULE'

interface AuditLog {
  id:        string
  action:    AuditAction
  entity:    AuditEntity
  entityId:  string
  userEmail: string | null
  metadata:  Record<string, unknown> | null
  ip:        string | null
  createdAt: string
}

interface PaginationInfo {
  total: number
  page: number
  totalPages: number
}

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:        'Creación',
  UPDATE:        'Edición',
  DELETE:        'Eliminación',
  STATUS_CHANGE: 'Cambio estado',
}

const ENTITY_LABELS: Record<AuditEntity, string> = {
  APPOINTMENT: 'Cita',
  CLIENT:      'Cliente',
  EXPENSE:     'Gasto',
  SERVICE:     'Servicio',
  GALLERY:     'Galería',
  SCHEDULE:    'Horario',
}

const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:        'bg-green-100 text-green-700',
  UPDATE:        'bg-blue-100 text-blue-700',
  DELETE:        'bg-red-100 text-red-700',
  STATUS_CHANGE: 'bg-amber-100 text-amber-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function MetadataPreview({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-ink-muted/50">—</span>
  const entries = Object.entries(data).slice(0, 4)
  return (
    <div className="space-y-0.5">
      {entries.map(([k, v]) => (
        <p key={k} className="text-[11px] text-ink-muted">
          <span className="font-medium text-ink-muted">{k}:</span>{' '}
          {String(v)}
        </p>
      ))}
      {Object.keys(data).length > 4 && (
        <p className="text-[10px] text-ink-muted/50">+{Object.keys(data).length - 4} más</p>
      )}
    </div>
  )
}

export default function AuditoriaPageClient() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const [logs, setLogs]             = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading]       = useState(true)
  // Below `lg` the "Detalle" column is hidden — this tracks which row's
  // detail is expanded inline instead, so that data isn't simply lost on mobile.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // The URL is the source of truth — survives refresh, back/forward, and
  // shared links. `replace` (not `push`) so paging/filtering doesn't spam history.
  const entity   = searchParams.get('entity')   ?? ''
  const action   = searchParams.get('action')   ?? ''
  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo   = searchParams.get('dateTo')   ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Any filter change resets to page 1
  function setFilter(key: string, value: string) {
    setParams({ [key]: value, page: null })
  }

  const queryKey = searchParams.toString()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (entity)   params.set('entity', entity)
    if (action)   params.set('action', action)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo)   params.set('dateTo', dateTo)

    try {
      const res  = await fetch(`/api/audit?${params}`)
      const json = await res.json()
      if (json.success) {
        setLogs(json.data.logs)
        setPagination(json.data.pagination)
      }
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function resetFilters() {
    router.replace(pathname, { scroll: false })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Sistema</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Auditoría</h1>
          <p className="text-sm text-ink-muted mt-0.5 hidden sm:block">
            Registro de todas las acciones sobre citas, clientes, gastos, servicios, horarios y galería.
          </p>
        </div>
        <span className="text-xs text-ink-muted bg-beige px-3 py-1.5 rounded-lg border border-beige-dark shrink-0">
          {pagination.total} registros
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-beige-dark p-3 sm:p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-ink-muted mb-1">Entidad</label>
          <select value={entity} onChange={e => setFilter('entity', e.target.value)}
            className="input-field text-sm bg-white">
            <option value="">Todas</option>
            {(Object.keys(ENTITY_LABELS) as AuditEntity[]).map(e => (
              <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Acción</label>
          <select value={action} onChange={e => setFilter('action', e.target.value)}
            className="input-field text-sm bg-white">
            <option value="">Todas</option>
            {(Object.keys(ACTION_LABELS) as AuditAction[]).map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}
            className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setFilter('dateTo', e.target.value)}
            className="input-field text-sm" />
        </div>
        <button onClick={resetFilters}
          className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline transition-colors">
          Limpiar filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-sm text-ink-muted">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-muted">Sin registros para los filtros seleccionados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige-dark bg-beige/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest hidden sm:table-cell">Entidad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest hidden md:table-cell">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted uppercase tracking-widest hidden lg:table-cell">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-dark/60">
              {logs.map(log => (
                <Fragment key={log.id}>
                  <tr className="hover:bg-beige/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-muted">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${ACTION_COLORS[log.action]}`}>
                          {ACTION_LABELS[log.action]}
                        </span>
                        <span className="sm:hidden text-xs text-ink-muted">{ENTITY_LABELS[log.entity]}</span>
                        {log.metadata && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(id => id === log.id ? null : log.id)}
                            className="btn-row-action lg:hidden text-[11px] text-gold hover:underline"
                          >
                            {expandedId === log.id ? 'Ocultar' : 'Ver detalle'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-ink hidden sm:table-cell">
                      {ENTITY_LABELS[log.entity]}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted hidden md:table-cell">
                      {log.userEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[260px] hidden lg:table-cell">
                      <MetadataPreview data={log.metadata} />
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="lg:hidden bg-beige/10">
                      <td colSpan={5} className="px-4 pb-3 pt-0">
                        <div className="md:hidden text-[11px] text-ink-muted mb-1.5">
                          {log.userEmail ?? '—'}
                        </div>
                        <MetadataPreview data={log.metadata} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPage={(p) => setParams({ page: String(p) })}
      />
    </div>
  )
}
