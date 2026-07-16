'use client'
// src/app/admin/(protected)/clientes/ClientesPageClient.tsx
// useSearchParams() requires this to be split out and wrapped in <Suspense> by page.tsx

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ClientSummary } from '@/types'
import { Pagination } from '@/components/admin/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { isValidPhone } from '@/lib/utils'
import { useFieldValidation } from '@/hooks/useFieldValidation'

const EMPTY_FORM = { name: '', email: '', phone: '', notes: '' }
// Validated on blur and on submit, in display order. Module-level so the hook
// keeps a stable reference; the ids match `new-client-<key>` for error focusing.
const VALIDATED_FIELDS = ['name', 'email', 'phone'] as const

export default function ClientesPageClient() {
  const { searchParams, setParams } = useUrlFilters()

  // The URL is the source of truth for page/search — survives refresh and
  // back/forward navigation.
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const query    = searchParams.get('search') ?? ''
  const archived = searchParams.get('archived') === '1'

  const [clients, setClients]   = useState<ClientSummary[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [searchInput, setSearchInput] = useState(query) // controlled text field

  // Create-client modal state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')
  const v = useFieldValidation(VALIDATED_FIELDS, (k) => {
    switch (k) {
      case 'name':
        if (!form.name.trim()) return 'El nombre es requerido'
        if (!/\p{L}/u.test(form.name)) return 'El nombre debe incluir letras'
        return undefined
      case 'phone':
        if (!form.phone.trim()) return 'El teléfono es requerido'
        if (!isValidPhone(form.phone)) return 'El teléfono debe tener entre 10 y 15 dígitos'
        return undefined
      case 'email':
        // Optional — only checked once something was typed.
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email inválido'
        return undefined
    }
  })

  // Keep the input in sync if the URL changes externally (e.g. back button)
  useEffect(() => { setSearchInput(query) }, [query])

  // Debounce: commit the typed search into the URL (resets to page 1)
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query) setParams({ search: searchInput || null, page: null })
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput, query, setParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (query) params.set('search', query)
      if (archived) params.set('archived', '1')
      const res = await fetch(`/api/clients?${params}`)
      const json = await res.json()
      if (json.success) {
        setClients(json.data.clients)
        setTotal(json.data.pagination.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, query, archived])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / 20)

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    const errs = v.validateAll()
    if (Object.keys(errs).length > 0) {
      const first = v.firstErrorKey(errs)
      if (first) document.getElementById(`new-client-${first}`)?.focus()
      return
    }

    setSaving(true); setFormError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:  form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { setFormError(json.error ?? 'No se pudo crear el cliente'); return }
      setShowCreate(false)
      setForm(EMPTY_FORM)
      v.reset()
      setParams({ page: null })
      await load()
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        className="mb-6"
        eyebrow="Configuración"
        title="Clientes"
        subtitle={`${total} cliente${total !== 1 ? 's' : ''} ${archived ? `archivado${total !== 1 ? 's' : ''}` : `registrado${total !== 1 ? 's' : ''}`}`}
        actions={
          <button onClick={() => { setForm(EMPTY_FORM); setFormError(''); v.reset(); setShowCreate(true) }}
            className="btn-primary text-sm">
            + Nuevo
          </button>
        }
      />

      {/* Search + archived toggle */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="input-field w-full sm:max-w-md"
        />
        <button
          onClick={() => setParams({ archived: archived ? null : '1', page: null })}
          className={`text-sm px-3 py-2 rounded-lg border whitespace-nowrap transition-colors ${
            archived
              ? 'bg-gold/10 border-gold text-gold-dark'
              : 'border-beige-dark text-ink-muted-deep hover:bg-beige/40'
          }`}>
          {archived ? '← Ver activos' : 'Ver archivados'}
        </button>
      </div>

      {archived && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
          Estás viendo clientes archivados. Abre uno para reactivarlo o eliminarlo.
        </div>
      )}

      {/* Table — desktop */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-ink-muted-deep text-sm">Cargando…</div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon="◉"
            title={query ? 'Sin resultados para esa búsqueda.'
              : archived ? 'No hay clientes archivados.'
              : 'Aún no hay clientes registrados.'}
            action={!query && !archived ? (
              <button onClick={() => { setForm(EMPTY_FORM); setFormError(''); v.reset(); setShowCreate(true) }}
                className="btn-primary text-sm">
                + Crear el primero
              </button>
            ) : undefined}
          />
        ) : (
          <>
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-beige/40 border-b border-beige-dark">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-xs text-ink-muted-deep uppercase tracking-widest">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-xs text-ink-muted-deep uppercase tracking-widest">Teléfono</th>
                  <th className="text-center px-5 py-3 font-medium text-xs text-ink-muted-deep uppercase tracking-widest">Citas</th>
                  <th className="text-left px-5 py-3 font-medium text-xs text-ink-muted-deep uppercase tracking-widest">Desde</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-dark/60">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-beige/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted-deep">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted-deep whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-block bg-gold/10 text-gold-dark text-xs font-medium px-2 py-0.5 rounded-full">
                        {c._count.appointments}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted-deep text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <Link href={`/admin/clientes/${c.id}`}
                        className="text-xs text-gold-deep hover:underline">
                        Ver historial →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-beige-dark/60">
              {clients.map(c => (
                <Link key={c.id} href={`/admin/clientes/${c.id}`}
                  className="block px-4 py-3 hover:bg-beige/20 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-ink">{c.name}</p>
                    <span className="inline-block bg-gold/10 text-gold-dark text-xs font-medium px-2 py-0.5 rounded-full">
                      {c._count.appointments} citas
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted-deep">{c.email}</p>
                  {c.phone && <p className="text-xs text-ink-muted-deep">{c.phone}</p>}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={(p) => setParams({ page: String(p) })} />

      {/* Create-client modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo cliente">
            <form onSubmit={createClient} noValidate className="px-6 py-5 space-y-4">
              <div>
                <label htmlFor="new-client-name" className="form-label">Nombre completo <span className="text-red-700">*</span></label>
                <input id="new-client-name" value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); v.clearError('name') }}
                  onBlur={v.handleBlur('name')}
                  placeholder="Ana García"
                  className={`input-field w-full ${v.errorOf('name') ? 'border-red-400 focus:ring-red-300' : ''}`} />
                {v.errorOf('name') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('name')}</p>}
              </div>
              <div>
                <label htmlFor="new-client-email" className="form-label">Email <span className="text-ink-muted-deep normal-case font-normal tracking-normal">(opcional)</span></label>
                <input id="new-client-email" type="email" value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); v.clearError('email') }}
                  onBlur={v.handleBlur('email')}
                  placeholder="ana@ejemplo.com"
                  className={`input-field w-full ${v.errorOf('email') ? 'border-red-400 focus:ring-red-300' : ''}`} />
                {v.errorOf('email') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('email')}</p>}
              </div>
              <div>
                <label htmlFor="new-client-phone" className="form-label">Teléfono <span className="text-red-700">*</span></label>
                <input id="new-client-phone" value={form.phone}
                  onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); v.clearError('phone') }}
                  onBlur={v.handleBlur('phone')}
                  placeholder="3001234567"
                  className={`input-field w-full ${v.errorOf('phone') ? 'border-red-400 focus:ring-red-300' : ''}`} />
                {v.errorOf('phone') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('phone')}</p>}
              </div>
              <div>
                <label className="form-label">Notas internas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Preferencias, observaciones…" className="input-field w-full resize-none" />
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Crear cliente'}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  )
}
