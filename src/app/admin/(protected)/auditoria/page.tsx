'use client'
// src/app/admin/auditoria/page.tsx

import { useState, useEffect, useCallback } from 'react'

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

interface Pagination {
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

const ENTITY_COLORS: Record<AuditEntity, string> = {
  APPOINTMENT: 'text-ink',
  CLIENT:      'text-ink',
  EXPENSE:     'text-ink',
  SERVICE:     'text-ink',
  GALLERY:     'text-ink',
  SCHEDULE:    'text-ink',
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
          <span className="font-medium text-ink-mid">{k}:</span>{' '}
          {String(v)}
        </p>
      ))}
      {Object.keys(data).length > 4 && (
        <p className="text-[10px] text-ink-muted/50">+{Object.keys(data).length - 4} más</p>
      )}
    </div>
  )
}

export default function AuditoriaPage() {
  const [logs, setLogs]           = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading]     = useState(true)
  const [entity, setEntity]       = useState('')
  const [action, setAction]       = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(1)

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
  }, [entity, action, dateFrom, dateTo, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function resetFilters() {
    setEntity(''); setAction(''); setDateFrom(''); setDateTo(''); setPage(1)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink">Auditoría</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Registro de todas las acciones sobre citas, clientes y gastos.
          </p>
        </div>
        <span className="text-xs text-ink-muted bg-beige px-3 py-1.5 rounded-lg border border-beige-dark">
          {pagination.total} registros
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-beige-dark rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-ink-muted mb-1">Entidad</label>
          <select value={entity} onChange={e => { setEntity(e.target.value); setPage(1) }}
            className="input-field text-sm bg-white">
            <option value="">Todas</option>
            {(Object.keys(ENTITY_LABELS) as AuditEntity[]).map(e => (
              <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Acción</label>
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
            className="input-field text-sm bg-white">
            <option value="">Todas</option>
            {(Object.keys(ACTION_LABELS) as AuditAction[]).map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="input-field text-sm" />
        </div>
        <button onClick={resetFilters}
          className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline transition-colors">
          Limpiar filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-beige-dark rounded-xl overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-sm text-ink-muted">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-muted">Sin registros para los filtros seleccionados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige-dark bg-beige/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-mid uppercase tracking-wider">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-mid uppercase tracking-wider">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-mid uppercase tracking-wider">Entidad</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-mid uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-mid uppercase tracking-wider">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-mid uppercase tracking-wider">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-dark/60">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-beige/20 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-muted">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${ACTION_COLORS[log.action]}`}>
                      {ACTION_LABELS[log.action]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${ENTITY_COLORS[log.entity]}`}>
                    {ENTITY_LABELS[log.entity]}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-ink-muted max-w-[120px] truncate">
                    {log.entityId}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {log.userEmail ?? '—'}
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <MetadataPreview data={log.metadata} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-muted">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-beige-dark rounded-lg text-ink-muted hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1.5 text-xs border border-beige-dark rounded-lg text-ink-muted hover:border-gold/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
