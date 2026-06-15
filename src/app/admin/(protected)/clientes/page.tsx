'use client'
// src/app/admin/(protected)/clientes/page.tsx

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ClientSummary } from '@/types'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export default function ClientesPage() {
  const [clients, setClients]   = useState<ClientSummary[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')  // debounced

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-ink">Clientes</h1>
          <p className="text-sm text-ink-muted mt-0.5">{total} cliente{total !== 1 ? 's' : ''} registrados</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md border border-beige-dark rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-gold/40 bg-white"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-ink-muted text-sm">Cargando…</div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">
            {query ? 'Sin resultados para esa búsqueda.' : 'Aún no hay clientes registrados.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-beige/40 border-b border-beige-dark">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-ink-mid">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-ink-mid">Teléfono</th>
                <th className="text-center px-4 py-3 font-medium text-ink-mid">Citas</th>
                <th className="text-left px-4 py-3 font-medium text-ink-mid">Desde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-dark/60">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-beige/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-muted">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-gold/10 text-gold-dark text-xs font-medium px-2 py-0.5 rounded-full">
                      {c._count.appointments}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs">
                    {new Date(c.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/clientes/${c.id}`}
                      className="text-xs text-gold hover:underline">
                      Ver historial →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-ink-muted">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-beige-dark disabled:opacity-30 hover:bg-beige/40">
            ← Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border border-beige-dark disabled:opacity-30 hover:bg-beige/40">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
