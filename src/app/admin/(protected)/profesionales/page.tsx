'use client'
// src/app/admin/profesionales/page.tsx
// Professionals CRUD — create, edit, activate/deactivate

import { useState, useEffect } from 'react'

interface Professional {
  id: string
  name: string
  specialty: string | null
  rating: number
  reviewCount: number
  isActive: boolean
  order: number
}

const EMPTY: Omit<Professional, 'id' | 'isActive'> = {
  name: '', specialty: '', rating: 5, reviewCount: 0, order: 0,
}

export default function ProfesionalesPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editing, setEditing]   = useState<Professional | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY)

  function load() {
    fetch('/api/professionals')
      .then((r) => r.json())
      .then((json) => { if (json.success) setProfessionals(json.data) })
      .catch(() => setError('Error al cargar profesionales'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
    setError(null)
  }

  function openEdit(p: Professional) {
    setEditing(p)
    setForm({
      name: p.name,
      specialty: p.specialty ?? '',
      rating: p.rating,
      reviewCount: p.reviewCount,
      order: p.order,
    })
    setShowForm(true)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }

    setSaving(true)
    setError(null)

    const url    = editing ? `/api/professionals/${editing.id}` : '/api/professionals'
    const method = editing ? 'PATCH' : 'POST'

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        specialty: form.specialty || undefined,
      }),
    })
    const json = await res.json()

    if (json.success) {
      setShowForm(false)
      setSuccess(editing ? 'Profesional actualizado' : 'Profesional creado')
      load()
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function toggleActive(p: Professional) {
    const res  = await fetch(`/api/professionals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    const json = await res.json()
    if (json.success) load()
    else setError(json.error)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Equipo</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Profesionales</h1>
          <p className="text-sm text-ink-muted mt-1">
            Cada profesional activo puede atender una cita a la vez — define la capacidad real de la agenda.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm shrink-0">+ Nuevo</button>
      </div>

      {/* Messages */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-5">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {/* Inline modal form */}
      {showForm && (
        <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 animate-fade-in">
          <h2 className="font-serif text-xl text-ink font-light mb-6">
            {editing ? 'Editar profesional' : 'Nuevo profesional'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="form-label">Nombre *</label>
              <input type="text" className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Valentina J."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Especialidad</label>
              <input type="text" className="input-field"
                value={form.specialty ?? ''}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                placeholder="Ej: Especialista master"
              />
            </div>

            <div>
              <label className="form-label">Calificación (0-5)</label>
              <input type="number" className="input-field" min={0} max={5} step={0.1}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="form-label">Número de reseñas</label>
              <input type="number" className="input-field" min={0}
                value={form.reviewCount}
                onChange={(e) => setForm({ ...form, reviewCount: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="form-label">Orden de aparición</label>
              <input type="number" className="input-field" min={0}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-ink-muted text-sm">Cargando...</div>
        ) : professionals.length === 0 ? (
          <div className="py-10 text-center text-ink-muted text-sm">
            No hay profesionales aún. Crea el primero.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {professionals.map((p) => (
              <div key={p.id}
                className={`flex items-center justify-between px-6 py-4 transition-opacity ${p.isActive ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-light to-gold
                                   flex items-center justify-center text-white font-serif font-semibold shrink-0">
                    {p.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{p.name}</p>
                    <p className="text-xs text-ink-muted truncate">
                      {p.specialty} {p.specialty && '·'} ★ {p.rating.toFixed(1)} · {p.reviewCount} citas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0">
                  {!p.isActive && (
                    <span className="text-[10px] tracking-widest uppercase bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                      Inactivo
                    </span>
                  )}
                  <button onClick={() => openEdit(p)} className="text-xs text-ink-muted hover:text-gold transition-colors">
                    Editar
                  </button>
                  <button onClick={() => toggleActive(p)}
                    className={`text-xs transition-colors ${p.isActive ? 'text-ink-muted hover:text-red-500' : 'text-green-600 hover:text-green-700'}`}>
                    {p.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
