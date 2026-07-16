'use client'
// src/app/admin/(protected)/citas/CitasList.tsx
// Client-driven appointments list. The page Server Component provides the first
// page (SSR from the URL); from there this component owns filtering via
// GET /api/appointments — debounced search, no full-page reloads. The URL is
// kept in sync with history.replaceState so views stay shareable/reloadable.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice, formatRequestedAt } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/appointmentStatus'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SCOPE_OPTIONS, SORT_OPTIONS, ORIGIN_OPTIONS } from '@/lib/appointmentList'

interface ServiceLite  { id: string; name: string }
interface CategoryLite { id: string; name: string }

interface Appt {
  id: string
  clientName: string
  clientEmail: string | null
  clientPhone: string
  date: string
  startTime: string
  status: string
  paymentStatus: string
  origin: string
  createdAt: string
  service: { name: string; price: number }
  services: { price: number; service: { name: string } }[]
}

interface Pagination { total: number; page: number; limit: number; totalPages: number }

export interface CitasFilters {
  search: string
  status: string   // '' = Todas
  scope: string
  origin: string   // '' = todos
  payment: string  // '' = todos · 'pending' = por cobrar · 'PAID' = pagadas
  serviceId: string
  categoryId: string
  amountMin: string
  amountMax: string
  dateFrom: string
  dateTo: string
  sort: string
}

const EMPTY_FILTERS: CitasFilters = {
  search: '', status: '', scope: 'upcoming', origin: '', payment: '',
  serviceId: '', categoryId: '', amountMin: '', amountMax: '',
  dateFrom: '', dateTo: '', sort: 'upcoming',
}

const SCOPE_LABELS:  Record<string, string> = { upcoming: 'Próximas', past: 'Pasadas', all: 'Todas' }
const ORIGIN_LABELS: Record<string, string> = { PUBLIC: 'Público', MANUAL: 'Manual', VIP: 'VIP', PAST: 'Pasada' }
const SORT_LABELS:   Record<string, string> = {
  upcoming: 'Próximas primero', recent: 'Recién solicitadas', oldest: 'Orden de llegada', status: 'Por estado',
}
const STATUS_FILTER = ['', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const

function buildQueryString(f: CitasFilters, page: number): string {
  const p = new URLSearchParams()
  if (f.search)                       p.set('search', f.search)
  if (f.status)                       p.set('status', f.status)
  if (f.scope && f.scope !== 'upcoming') p.set('scope', f.scope)
  if (f.origin)                       p.set('origin', f.origin)
  if (f.payment)                      p.set('payment', f.payment)
  if (f.serviceId)                    p.set('serviceId', f.serviceId)
  if (f.categoryId)                   p.set('categoryId', f.categoryId)
  if (f.amountMin)                    p.set('amountMin', f.amountMin)
  if (f.amountMax)                    p.set('amountMax', f.amountMax)
  if (f.dateFrom)                     p.set('dateFrom', f.dateFrom)
  if (f.dateTo)                       p.set('dateTo', f.dateTo)
  if (f.sort && f.sort !== 'upcoming')   p.set('sort', f.sort)
  if (page > 1)                       p.set('page', String(page))
  return p.toString()
}

function serviceNames(a: Appt): string {
  return a.services && a.services.length > 1
    ? a.services.map((s) => s.service.name).join(' + ')
    : a.service.name
}
function serviceTotal(a: Appt): number {
  return a.services && a.services.length > 1
    ? a.services.reduce((sum, s) => sum + s.price, 0)
    : a.service.price
}

// Small amber pill flagging an appointment that still owes money. Rendered next
// to the status badge so a rendered-but-unpaid ("Completada" + this) row stands out.
function PaymentPill({ paymentStatus }: { paymentStatus: string }) {
  if (paymentStatus !== 'PENDING' && paymentStatus !== 'PARTIAL') return null
  return (
    <span className="text-2xs tracking-wide uppercase bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      {paymentStatus === 'PARTIAL' ? 'Pago parcial' : 'Pendiente de pago'}
    </span>
  )
}

export default function CitasList({
  initialAppointments, initialPagination, initialFilters, services, categories,
}: {
  initialAppointments: Appt[]
  initialPagination: Pagination
  initialFilters: CitasFilters
  services: ServiceLite[]
  categories: CategoryLite[]
}) {
  const [filters, setFilters]           = useState<CitasFilters>(initialFilters)
  const [appointments, setAppointments] = useState<Appt[]>(initialAppointments)
  const [pagination, setPagination]     = useState<Pagination>(initialPagination)
  const [page, setPage]                 = useState(initialPagination.page)
  const [loading, setLoading]           = useState(false)
  const [showMore, setShowMore]         = useState(
    !!(initialFilters.serviceId || initialFilters.categoryId ||
       initialFilters.amountMin || initialFilters.amountMax ||
       initialFilters.dateFrom  || initialFilters.dateTo),
  )

  // SSR already delivered the first page → skip the initial fetch.
  const firstRender = useRef(true)
  const abortRef    = useRef<AbortController | null>(null)

  const runFetch = useCallback(async (f: CitasFilters, p: number) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    const qs = buildQueryString(f, p)
    try {
      const res  = await fetch(`/api/appointments?${qs}`, { signal: ctrl.signal })
      const json = await res.json()
      if (json.success) {
        setAppointments(json.data.appointments)
        setPagination(json.data.pagination)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error('Error filtrando citas:', e)
    } finally {
      // Only the latest (winning) request updates the URL + clears loading;
      // superseded requests were aborted and must not flicker a stale URL.
      if (abortRef.current === ctrl) {
        window.history.replaceState(null, '', qs ? `/admin/citas?${qs}` : '/admin/citas')
        setLoading(false)
      }
    }
  }, [])

  // Debounced refetch on any filter/page change. Search benefits from the 300ms;
  // the other controls pass through harmlessly (a click already feels instant).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const t = setTimeout(() => runFetch(filters, page), 300)
    return () => clearTimeout(t)
  }, [filters, page, runFetch])

  // A manual appointment created in the sibling modal fires this event so the
  // list refetches with the current filters (no full reload). A past appointment
  // also switches the list to the "Pasadas" scope so it's actually visible.
  useEffect(() => {
    const onCreated = (e: Event) => {
      const scope = (e as CustomEvent<{ scope: string | null }>).detail?.scope
      if (scope) { setFilters((f) => ({ ...f, scope })); setPage(1) }
      else runFetch(filters, page)
    }
    window.addEventListener('cita-creada', onCreated)
    return () => window.removeEventListener('cita-creada', onCreated)
  }, [filters, page, runFetch])

  function patch(p: Partial<CitasFilters>) { setFilters((f) => ({ ...f, ...p })); setPage(1) }
  function clearAll() { setFilters(EMPTY_FILTERS); setPage(1); setShowMore(false) }

  // Active-filter chips (removable)
  const chips: { label: string; clear: () => void }[] = []
  if (filters.search)            chips.push({ label: `"${filters.search}"`, clear: () => patch({ search: '' }) })
  if (filters.status)            chips.push({ label: STATUS_LABEL[filters.status as keyof typeof STATUS_LABEL] ?? filters.status, clear: () => patch({ status: '' }) })
  if (filters.scope !== 'upcoming') chips.push({ label: `Ver: ${SCOPE_LABELS[filters.scope]}`, clear: () => patch({ scope: 'upcoming' }) })
  if (filters.origin)            chips.push({ label: `Origen: ${ORIGIN_LABELS[filters.origin]}`, clear: () => patch({ origin: '' }) })
  if (filters.payment)           chips.push({ label: filters.payment === 'pending' ? 'Pendiente de pago' : 'Pagadas', clear: () => patch({ payment: '' }) })
  if (filters.serviceId)         chips.push({ label: services.find((s) => s.id === filters.serviceId)?.name ?? 'Servicio', clear: () => patch({ serviceId: '' }) })
  if (filters.categoryId)        chips.push({ label: categories.find((c) => c.id === filters.categoryId)?.name ?? 'Categoría', clear: () => patch({ categoryId: '' }) })
  if (filters.amountMin || filters.amountMax)
    chips.push({ label: `Valor ${filters.amountMin || '0'}–${filters.amountMax || '∞'}`, clear: () => patch({ amountMin: '', amountMax: '' }) })
  if (filters.dateFrom || filters.dateTo)
    chips.push({ label: `${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`, clear: () => patch({ dateFrom: '', dateTo: '' }) })

  const hasFilters = chips.length > 0 || filters.sort !== 'upcoming'

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-beige-dark p-3 sm:p-4 mb-4 space-y-3">

        {/* Search (full width) */}
        <input
          type="search"
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          placeholder="🔍 Buscar cliente, servicio o código…"
          aria-label="Buscar citas"
          className="input-field w-full"
        />

        {/* Primary controls */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label text-2xs">Estado</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTER.map((s) => (
                <button key={s || 'ALL'} type="button"
                  // A COMPLETED appointment is always past/today, so "Próximas"
                  // would show nothing — switch to "Todas" so the filter is useful.
                  onClick={() => patch(s === 'COMPLETED' && filters.scope === 'upcoming' ? { status: s, scope: 'all' } : { status: s })}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs border rounded-lg transition-colors
                    ${filters.status === s
                      ? 'bg-ink border-ink text-white'
                      : 'bg-white border-beige-dark text-ink-muted-deep hover:border-gold'}`}>
                  {s ? STATUS_LABEL[s as keyof typeof STATUS_LABEL] : 'Todas'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label text-2xs">Ver</label>
            <div className="flex gap-1.5 flex-wrap">
              {SCOPE_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => patch({ scope: s })}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs border rounded-lg transition-colors
                    ${filters.scope === s
                      ? 'bg-ink border-ink text-white'
                      : 'bg-white border-beige-dark text-ink-muted-deep hover:border-gold'}`}>
                  {SCOPE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label text-2xs">Pago</label>
            <div className="flex gap-1.5 flex-wrap">
              {([['', 'Todos'], ['pending', 'Pendiente'], ['PAID', 'Pagadas']] as const).map(([v, l]) => (
                <button key={v || 'ALL'} type="button"
                  // "Pendiente" targets past receivables, so from the default "Próximas"
                  // view switch to "Pasadas" — where a future booking isn't trivially
                  // PENDING by default.
                  onClick={() => patch(v === 'pending' && filters.scope === 'upcoming' ? { payment: v, scope: 'past' } : { payment: v })}
                  className={`px-3 py-2.5 sm:py-1.5 text-xs border rounded-lg transition-colors
                    ${filters.payment === v
                      ? 'bg-ink border-ink text-white'
                      : 'bg-white border-beige-dark text-ink-muted-deep hover:border-gold'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="f-origen" className="form-label text-2xs">Origen</label>
            <select id="f-origen" value={filters.origin} onChange={(e) => patch({ origin: e.target.value })}
              className="input-field py-1.5 bg-white">
              <option value="">Todos</option>
              {ORIGIN_OPTIONS.map((o) => <option key={o} value={o}>{ORIGIN_LABELS[o]}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="f-ordenar" className="form-label text-2xs">Ordenar</label>
            <select id="f-ordenar" value={filters.sort} onChange={(e) => patch({ sort: e.target.value })}
              className="input-field py-1.5 bg-white">
              {SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
            </select>
          </div>

          <button type="button" onClick={() => setShowMore((v) => !v)}
            className="text-xs text-ink-muted-deep hover:text-gold-deep transition-colors self-end pb-2 sm:pb-1.5">
            {showMore ? 'Menos filtros ▴' : 'Más filtros ▾'}
          </button>
        </div>

        {/* Secondary controls (collapsible / drawer-like on mobile) */}
        {showMore && (
          <div className="flex flex-wrap gap-3 items-end border-t border-beige-dark pt-3">
            <div>
              <label className="form-label text-2xs">Servicio</label>
              <select value={filters.serviceId} onChange={(e) => patch({ serviceId: e.target.value })}
                className="input-field py-1.5 bg-white max-w-[200px]">
                <option value="">Todos</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-2xs">Categoría</label>
              <select value={filters.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}
                className="input-field py-1.5 bg-white">
                <option value="">Todas</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-2xs">Valor mín</label>
              <input type="number" min={0} step={1000} value={filters.amountMin}
                onChange={(e) => patch({ amountMin: e.target.value })}
                className="input-field py-1.5 w-28" placeholder="0" />
            </div>
            <div>
              <label className="form-label text-2xs">Valor máx</label>
              <input type="number" min={0} step={1000} value={filters.amountMax}
                onChange={(e) => patch({ amountMax: e.target.value })}
                className="input-field py-1.5 w-28" placeholder="∞" />
            </div>
            <div>
              <label className="form-label text-2xs">Desde</label>
              <input type="date" value={filters.dateFrom}
                onChange={(e) => patch({ dateFrom: e.target.value })}
                className="input-field py-1.5 w-36" />
            </div>
            <div>
              <label className="form-label text-2xs">Hasta</label>
              <input type="date" value={filters.dateTo}
                onChange={(e) => patch({ dateTo: e.target.value })}
                className="input-field py-1.5 w-36" />
            </div>
          </div>
        )}

        {/* Chips + clear */}
        {(chips.length > 0 || hasFilters) && (
          <div className="flex flex-wrap gap-2 items-center pt-1">
            {chips.map((c, i) => (
              <button key={i} type="button" onClick={c.clear}
                className="inline-flex items-center gap-1 text-xs bg-gold-pale text-ink border border-gold/30 rounded-full px-2.5 py-1 hover:bg-gold/20 transition-colors">
                {c.label} <span className="text-ink-muted-deep">×</span>
              </button>
            ))}
            <button type="button" onClick={clearAll}
              className="text-xs text-ink-muted-deep hover:text-gold-deep transition-colors">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Counter */}
      <p className="text-xs text-ink-muted-deep mb-2 flex items-center gap-2">
        {loading ? 'Buscando…' : `${pagination.total} cita${pagination.total === 1 ? '' : 's'} encontrada${pagination.total === 1 ? '' : 's'}`}
      </p>

      {/* Results */}
      <div className={`bg-white rounded-xl border border-beige-dark overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {appointments.length === 0 ? (
          <div className="py-16 text-center text-ink-muted-deep text-sm">
            {loading ? 'Cargando…' : (
              <>
                <p className="mb-3">No hay citas con los filtros seleccionados.</p>
                {hasFilters && (
                  <button type="button" onClick={clearAll} className="btn-secondary text-xs">Limpiar filtros</button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Table — desktop */}
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-beige-dark bg-beige text-xs text-ink-muted-deep uppercase tracking-widest">
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 font-medium">Hora</th>
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Servicio</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Valor</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Origen</th>
                  <th className="text-left px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-dark">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-beige transition-colors group">
                    <td className="px-5 py-3.5 text-ink whitespace-nowrap">
                      {format(new Date(appt.date), 'd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted-deep font-mono text-xs">{appt.startTime}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-ink font-medium flex items-center gap-1.5">
                        {appt.clientName}
                        {!appt.clientEmail && (
                          <span className="text-2xs tracking-wide uppercase bg-beige text-ink-muted-deep border border-beige-dark px-1.5 py-0.5 rounded-full">
                            sin correo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-muted-deep">{appt.clientPhone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted-deep">{serviceNames(appt)}</td>
                    <td className="px-5 py-3.5 text-gold-deep hidden lg:table-cell">{formatPrice(serviceTotal(appt))}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-2xs tracking-wide uppercase bg-beige text-ink-muted-deep border border-beige-dark px-2 py-0.5 rounded-full">
                        {ORIGIN_LABELS[appt.origin] ?? appt.origin}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={appt.status} />
                        <PaymentPill paymentStatus={appt.paymentStatus} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/admin/citas/${appt.id}`}
                        className="text-xs text-gold-deep group-hover:text-gold-dark transition-colors">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-beige-dark">
              {appointments.map((appt) => (
                <Link key={appt.id} href={`/admin/citas/${appt.id}`}
                  className="block px-4 py-3 hover:bg-beige transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                      {appt.clientName}
                      {!appt.clientEmail && (
                        <span className="text-2xs tracking-wide uppercase bg-beige text-ink-muted-deep border border-beige-dark px-1.5 py-0.5 rounded-full">
                          sin correo
                        </span>
                      )}
                    </p>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={appt.status} />
                      <PaymentPill paymentStatus={appt.paymentStatus} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-muted-deep">
                    <span>{format(new Date(appt.date), 'd MMM', { locale: es })} · {appt.startTime}</span>
                    <span className="text-gold-deep">{formatPrice(serviceTotal(appt))}</span>
                  </div>
                  <p className="text-xs text-ink-muted-deep mt-0.5">{serviceNames(appt)}</p>
                  <p className="text-2xs text-ink-muted-deep mt-0.5">
                    {ORIGIN_LABELS[appt.origin] ?? appt.origin} · Solicitada: {formatRequestedAt(new Date(appt.createdAt))}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-ink-muted-deep">{pagination.total} citas · Página {pagination.page} de {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2.5 sm:py-1.5 text-xs border border-beige-dark rounded-lg text-ink-muted-deep hover:border-gold transition-colors disabled:opacity-40 disabled:hover:border-beige-dark">
              ← Anterior
            </button>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2.5 sm:py-1.5 text-xs border border-beige-dark rounded-lg text-ink-muted-deep hover:border-gold transition-colors disabled:opacity-40 disabled:hover:border-beige-dark">
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
