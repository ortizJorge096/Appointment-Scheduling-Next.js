'use client'
// src/app/admin/(protected)/clientes/ClientesPageClient.tsx
// useSearchParams() requires this to be split out and wrapped in <Suspense> by page.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ClientSummary } from '@/types'
import { Pagination } from '@/components/admin/Pagination'

const EMPTY_FORM = { name: '', email: '', phone: '', notes: '' }

export default function ClientesPageClient() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // The URL is the source of truth for page/search — survives refresh and
  // back/forward navigation. `replace` (not `push`) avoids spamming history.
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const query = searchParams.get('search') ?? ''

  const [clients, setClients]   = useState<ClientSummary[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [searchInput, setSearchInput] = useState(query) // controlled text field

  // Create-client modal state
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Keep the input in sync if the URL changes externally (e.g. back button)
  useEffect(() => { setSearchInput(query) }, [query])

  // Debounce: commit the typed search into the URL (resets to page 1)
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query) setParams({ search: searchInput || null, page: null })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (query) params.set('search', query)
      const res = await fetch(`/api/clients?${params}`)
      const json = await res.json()
      if (json.success) {
        setClients(json.data.clients)
        setTotal(json.data.pagination.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / 20)

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:  form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { setFormError(json.error ?? 'No se pudo crear el cliente'); return }
      setShowCreate(false)
      setForm(EMPTY_FORM)
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Configuración</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Clientes</h1>
          <p className="text-sm text-ink-muted mt-0.5">{total} cliente{total !== 1 ? 's' : ''} registrados</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowCreate(true) }}
          className="btn-primary text-sm">
          + Nuevo
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="input-field w-full max-w-md text-sm"
        />
      </div>

      {/* Table — desktop */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-ink-muted text-sm">Cargando…</div>
        ) : clients.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="text-3xl opacity-40 mb-2">◉</div>
            <p className="text-ink-muted text-sm">
              {query ? 'Sin resultados para esa búsqueda.' : 'Aún no hay clientes registrados.'}
            </p>
            {!query && (
              <button onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowCreate(true) }}
                className="btn-primary text-sm mt-4">
                + Crear el primero
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-beige/40 border-b border-beige-dark">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-xs text-ink-muted uppercase tracking-widest">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium text-xs text-ink-muted uppercase tracking-widest">Teléfono</th>
                  <th className="text-center px-5 py-3 font-medium text-xs text-ink-muted uppercase tracking-widest">Citas</th>
                  <th className="text-left px-5 py-3 font-medium text-xs text-ink-muted uppercase tracking-widest">Desde</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-beige-dark/60">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-beige/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-block bg-gold/10 text-gold-dark text-xs font-medium px-2 py-0.5 rounded-full">
                        {c._count.appointments}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <Link href={`/admin/clientes/${c.id}`}
                        className="text-xs text-gold hover:underline">
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
                  <p className="text-xs text-ink-muted">{c.email}</p>
                  {c.phone && <p className="text-xs text-ink-muted">{c.phone}</p>}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={(p) => setParams({ page: String(p) })} />

      {/* Create-client modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink">Nuevo cliente</h2>
              <button onClick={() => setShowCreate(false)}
                className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
            </div>
            <form onSubmit={createClient} noValidate className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Nombre completo <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ana García" required className="input-field w-full" />
              </div>
              <div>
                <label className="form-label">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ana@ejemplo.com" required className="input-field w-full" />
              </div>
              <div>
                <label className="form-label">Teléfono</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="3001234567" className="input-field w-full" />
              </div>
              <div>
                <label className="form-label">Notas internas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Preferencias, observaciones…" className="input-field w-full resize-none" />
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
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
          </div>
        </div>
      )}
    </div>
  )
}
