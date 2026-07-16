'use client'
// src/app/admin/(protected)/auditoria/AuditoriaPageClient.tsx
// useSearchParams() requires this to be split out and wrapped in <Suspense> by page.tsx

import { Fragment, useState, useEffect, useCallback } from 'react'
import { Pagination } from '@/components/admin/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import {
  ACTION_LABELS, ENTITY_LABELS, ACTOR_LABELS, ACTION_EMOJI,
  formatDiff, formatValue, fieldLabel,
  type AuditAction, type AuditEntity, type AuditActor,
} from '@/lib/auditFormat'

interface AuditLog {
  id:          string
  action:      AuditAction
  entity:      AuditEntity
  entityId:    string
  actorType:   AuditActor | null
  userEmail:   string | null
  ip:          string | null
  userAgent:   string | null
  before:      Record<string, unknown> | null
  after:       Record<string, unknown> | null
  description: string | null
  metadata:    Record<string, unknown> | null
  createdAt:   string
}

interface PaginationInfo {
  total: number
  page: number
  totalPages: number
}

// Action/entity/actor labels + emoji live in src/lib/auditFormat.ts (shared with
// the CSV export). Only the view-specific colors stay here.
const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE: 'bg-green-100 text-green-700', UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700', STATUS_CHANGE: 'bg-amber-100 text-amber-700',
  CANCEL: 'bg-red-100 text-red-700', LOGIN: 'bg-green-100 text-green-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700', LOGOUT: 'bg-gray-100 text-gray-600',
  EMAIL_SENT: 'bg-blue-100 text-blue-700', EMAIL_FAILED: 'bg-red-100 text-red-700',
  EXPORT: 'bg-gray-100 text-gray-600',
}

const ACTOR_COLORS: Record<AuditActor, string> = {
  ADMIN: 'bg-gold-pale text-gold-deep', CLIENT: 'bg-blue-50 text-blue-700', SYSTEM: 'bg-gray-100 text-gray-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Readable, Spanish diff of what changed: "Campo: antes → después", with nulls and
// unchanged fields omitted. Historical rows (English keys) render the same way.
function DetailPanel({ log }: { log: AuditLog }) {
  const diff = formatDiff(log.before, log.after, log.action)
  const meta = log.metadata && Object.keys(log.metadata).length > 0 ? log.metadata : null
  return (
    <div className="space-y-2">
      {diff.length > 0 ? (
        <div className="space-y-1">
          {diff.map((d, i) => (
            <p key={i} className="text-[12px] text-ink break-words">
              <span className="font-medium text-ink-muted-deep">{d.label}:</span>{' '}
              {d.kind === 'removed' ? (
                <><span className="line-through text-red-700/80">{d.text}</span><span className="text-ink-muted-deep"> (eliminado)</span></>
              ) : d.text}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-ink-muted-deep">Sin cambios de datos.</p>
      )}
      {meta && (
        <div className="pt-1 border-t border-beige-dark/50">
          <p className="text-[10px] uppercase tracking-widest text-ink-muted-deep mb-0.5">Detalle</p>
          {Object.entries(meta).map(([k, v]) => (
            <p key={k} className="text-[11px] text-ink-muted-deep break-words">
              <span className="font-medium">{fieldLabel(k)}:</span> {formatValue(k, v)}
            </p>
          ))}
        </div>
      )}
      {(log.ip || log.userAgent) && (
        <p className="text-[10px] text-ink-muted-deep break-all">
          {log.ip ?? ''}{log.userAgent ? ` · ${log.userAgent}` : ''}
        </p>
      )}
    </div>
  )
}

export default function AuditoriaPageClient() {
  const { searchParams, setParams, reset } = useUrlFilters()

  const [logs, setLogs]             = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // URL is the source of truth (survives refresh / back-forward / shared links)
  const entity    = searchParams.get('entity')    ?? ''
  const action    = searchParams.get('action')    ?? ''
  const actorType = searchParams.get('actorType') ?? ''
  const search    = searchParams.get('search')    ?? ''
  const dateFrom  = searchParams.get('dateFrom')  ?? ''
  const dateTo    = searchParams.get('dateTo')    ?? ''
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  const [searchInput, setSearchInput] = useState(search)

  function setFilter(key: string, value: string) {
    setParams({ [key]: value, page: null })
  }

  // Keep input synced if URL changes externally; debounce typing into the URL.
  useEffect(() => { setSearchInput(search) }, [search])
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) setParams({ search: searchInput || null, page: null })
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput, search, setParams])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (entity)    params.set('entity', entity)
    if (action)    params.set('action', action)
    if (actorType) params.set('actorType', actorType)
    if (search)    params.set('search', search)
    if (dateFrom)  params.set('dateFrom', dateFrom)
    if (dateTo)    params.set('dateTo', dateTo)

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
  }, [page, entity, action, actorType, search, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function resetFilters() {
    setSearchInput('')
    reset()
  }

  // CSV export keeps the active filters, drops paging.
  const exportParams = new URLSearchParams()
  if (entity)    exportParams.set('entity', entity)
  if (action)    exportParams.set('action', action)
  if (actorType) exportParams.set('actorType', actorType)
  if (search)    exportParams.set('search', search)
  if (dateFrom)  exportParams.set('dateFrom', dateFrom)
  if (dateTo)    exportParams.set('dateTo', dateTo)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Auditoría"
        subtitle={<span className="hidden sm:block">Registro de acciones de admin, clientes y sistema.</span>}
        actions={
          <>
            <a href={`/api/audit/export?${exportParams.toString()}`}
              className="btn-secondary text-xs px-3 py-2.5 min-h-11 inline-flex items-center">Exportar CSV</a>
            <span className="text-xs text-ink-muted-deep bg-beige px-3 py-1.5 rounded-lg border border-beige-dark">
              {pagination.total}
            </span>
          </>
        }
      />

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por cliente, cita o usuario…"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="input-field w-full max-w-md"
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-beige-dark p-3 sm:p-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end">
        <div className="min-w-0">
          <label className="block text-xs text-ink-muted-deep mb-1">Entidad</label>
          <select value={entity} onChange={e => setFilter('entity', e.target.value)} className="input-field bg-white w-full min-w-0">
            <option value="">Todas</option>
            {(Object.keys(ENTITY_LABELS) as AuditEntity[]).map(e => <option key={e} value={e}>{ENTITY_LABELS[e]}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs text-ink-muted-deep mb-1">Acción</label>
          <select value={action} onChange={e => setFilter('action', e.target.value)} className="input-field bg-white w-full min-w-0">
            <option value="">Todas</option>
            {(Object.keys(ACTION_LABELS) as AuditAction[]).map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs text-ink-muted-deep mb-1">Actor</label>
          <select value={actorType} onChange={e => setFilter('actorType', e.target.value)} className="input-field bg-white w-full min-w-0">
            <option value="">Todos</option>
            {(Object.keys(ACTOR_LABELS) as AuditActor[]).map(a => <option key={a} value={a}>{ACTOR_LABELS[a]}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs text-ink-muted-deep mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} className="input-field w-full min-w-0" />
        </div>
        <div className="min-w-0">
          <label className="block text-xs text-ink-muted-deep mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setFilter('dateTo', e.target.value)} className="input-field w-full min-w-0" />
        </div>
        <button onClick={resetFilters}
          className="col-span-2 sm:col-auto justify-center text-xs text-ink-muted-deep hover:text-ink underline-offset-2 hover:underline transition-colors min-h-11 inline-flex items-center">
          Limpiar filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-sm text-ink-muted-deep">Cargando...</div>
        ) : logs.length === 0 ? (
          <EmptyState title="Sin registros para los filtros seleccionados." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-beige-dark bg-beige/40">
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted-deep uppercase tracking-widest">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted-deep uppercase tracking-widest">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted-deep uppercase tracking-widest hidden sm:table-cell">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-muted-deep uppercase tracking-widest">Descripción</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-dark/60">
              {logs.map(log => {
                const expanded = expandedId === log.id
                const actor = log.actorType ?? 'ADMIN'
                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-beige/20 transition-colors align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-muted-deep">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${ACTION_COLORS[log.action]}`}>
                          <span aria-hidden>{ACTION_EMOJI[log.action]}</span> {ACTION_LABELS[log.action]}
                        </span>
                        <span className="ml-1.5 text-[10px] text-ink-muted-deep">{ENTITY_LABELS[log.entity]}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ACTOR_COLORS[actor]}`}>
                          {ACTOR_LABELS[actor]}
                        </span>
                        {log.userEmail && (
                          <p className="text-[10px] text-ink-muted-deep mt-0.5 max-w-[150px] truncate">{log.userEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <span className="text-[13px]">{log.description ?? <span className="text-ink-muted-deep italic">{ENTITY_LABELS[log.entity]} · {ACTION_LABELS[log.action]}</span>}</span>
                        <span className="sm:hidden block mt-0.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] ${ACTOR_COLORS[actor]}`}>{ACTOR_LABELS[actor]}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {(log.before || log.after || log.metadata) && (
                          <button type="button" onClick={() => setExpandedId(expanded ? null : log.id)}
                            className="btn-row-action text-[11px] text-gold-deep hover:underline">
                            {expanded ? 'Ocultar' : 'Ver cambios'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-beige/10">
                        <td colSpan={5} className="px-4 pb-3 pt-0">
                          <div className="md:hidden text-[11px] text-ink-muted-deep mb-1.5">{log.userEmail ?? '—'}</div>
                          <DetailPanel log={log} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
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
