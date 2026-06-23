'use client'
// src/components/admin/ClientSearchInput.tsx
// Reusable client search/autocomplete. Headless about the rest of the form —
// it only reports what the admin picked or typed; the parent owns the
// actual clientName/clientEmail/clientPhone fields.

import { useState, useEffect, useRef, useCallback } from 'react'

export interface ClientHit {
  id: string
  name: string
  email: string
  phone: string | null
  appointmentCount: number
}

interface ClientsApiResponse {
  success: boolean
  data?: {
    clients: Array<{ id: string; name: string; email: string; phone: string | null; _count: { appointments: number } }>
  }
}

const MIN_CHARS = 2
const MAX_RESULTS = 8
const DEBOUNCE_MS = 300

export default function ClientSearchInput({
  onSelect,
  onCreateNew,
  placeholder = 'Buscar cliente por nombre o email…',
  className = '',
}: {
  onSelect: (client: ClientHit) => void
  onCreateNew: (query: string) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<ClientHit[]>([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`)
      const json: ClientsApiResponse = await res.json()
      if (json.success && json.data) {
        setResults(json.data.clients.map((c) => ({
          id: c.id, name: c.name, email: c.email, phone: c.phone,
          appointmentCount: c._count.appointments,
        })))
      }
    } catch {
      /* ignore network errors in the picker — admin can still type manually */
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search, only once the query is long enough
  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_CHARS) { setResults([]); setLoading(false); return }
    const t = setTimeout(() => search(q), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, search])

  // Reset keyboard highlight whenever the visible options change
  useEffect(() => { setHighlighted(0) }, [results, query])

  // Click outside closes the dropdown
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const showDropdown = open && query.trim().length >= MIN_CHARS
  const optionCount   = results.length + 1 // +1 for "Crear cliente nuevo"

  function pick(client: ClientHit) {
    onSelect(client)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function createNew() {
    onCreateNew(query.trim())
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, optionCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted < results.length) pick(results[highlighted])
      else createNew()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Buscar cliente existente"
        className="input-field w-full pr-9"
        autoComplete="off"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">
        {loading ? '…' : '⌕'}
      </span>

      {showDropdown && (
        <ul role="listbox" className="absolute z-10 left-0 right-0 mt-1 bg-white border border-beige-dark
                       rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === highlighted}>
              <button type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => pick(c)}
                className={`w-full text-left px-4 py-2.5 transition-colors ${
                  i === highlighted ? 'bg-gold-pale' : 'hover:bg-gold-pale'
                }`}>
                <span className="block text-sm text-ink font-medium">{c.name}</span>
                <span className="block text-xs text-ink-muted">
                  {c.email}
                  {c.appointmentCount > 0 && ` · ${c.appointmentCount} cita${c.appointmentCount === 1 ? '' : 's'}`}
                </span>
              </button>
            </li>
          ))}

          {!loading && results.length === 0 && (
            <li className="px-4 py-2.5 text-xs text-ink-muted border-b border-beige-dark">
              No encontrado
            </li>
          )}

          <li role="option" aria-selected={highlighted === results.length}>
            <button type="button"
              onMouseEnter={() => setHighlighted(results.length)}
              onClick={createNew}
              className={`w-full text-left px-4 py-2.5 text-sm text-gold font-medium transition-colors ${
                highlighted === results.length ? 'bg-gold-pale' : 'hover:bg-gold-pale'
              }`}>
              + Crear cliente nuevo
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
