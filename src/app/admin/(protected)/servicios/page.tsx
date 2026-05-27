'use client'
// src/app/admin/servicios/page.tsx
// CRUD de servicios — crear, editar, activar/desactivar

import { useState, useEffect } from 'react'

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  durationMinutes: number
  isActive: boolean
  order: number
}

const EMPTY: Omit<Service, 'id' | 'isActive'> = {
  name: '', description: '', price: 0, durationMinutes: 45, order: 0,
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  // Formulario
  const [editing, setEditing]   = useState<Service | null>(null)   // null = nuevo
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY)

  function load() {
    setLoading(true)
    fetch('/api/services')
      .then((r) => r.json())
      .then((json) => { if (json.success) setServices(json.data) })
      .catch(() => setError('Error al cargar servicios'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
    setError(null)
  }

  function openEdit(svc: Service) {
    setEditing(svc)
    setForm({
      name: svc.name,
      description: svc.description ?? '',
      price: svc.price,
      durationMinutes: svc.durationMinutes,
      order: svc.order,
    })
    setShowForm(true)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.price <= 0)   { setError('El precio debe ser mayor a 0'); return }

    setSaving(true)
    setError(null)

    const url    = editing ? `/api/services/${editing.id}` : '/api/services'
    const method = editing ? 'PATCH' : 'POST'

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        description: form.description || undefined,
      }),
    })
    const json = await res.json()

    if (json.success) {
      setShowForm(false)
      setSuccess(editing ? 'Servicio actualizado' : 'Servicio creado')
      load()
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function toggleActive(svc: Service) {
    const res  = await fetch(`/api/services/${svc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !svc.isActive }),
    })
    const json = await res.json()
    if (json.success) load()
    else setError(json.error)
  }

  return (
    <div className="p-8 max-w-4xl">

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Catálogo</p>
          <h1 className="font-serif text-3xl text-ink font-light">Servicios</h1>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nuevo servicio</button>
      </div>

      {/* Mensajes */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-5">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {/* Formulario (modal inline) */}
      {showForm && (
        <div className="bg-white border border-beige-dark p-6 mb-8 animate-fade-in">
          <h2 className="font-serif text-xl text-ink font-light mb-6">
            {editing ? 'Editar servicio' : 'Nuevo servicio'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="form-label">Nombre *</label>
              <input type="text" className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Manicure en gel"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Descripción</label>
              <textarea className="input-field resize-none" rows={2}
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción breve del servicio"
              />
            </div>

            <div>
              <label className="form-label">Precio (COP) *</label>
              <input type="number" className="input-field" min={0} step={1000}
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                placeholder="45000"
              />
            </div>

            <div>
              <label className="form-label">Duración (minutos) *</label>
              <input type="number" className="input-field" min={15} step={15}
                value={form.durationMinutes || ''}
                onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 0 })}
                placeholder="60"
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

      {/* Lista */}
      <div className="bg-white border border-beige-dark divide-y divide-beige-dark">
        {loading ? (
          <div className="py-10 text-center text-ink-muted text-sm">Cargando...</div>
        ) : services.length === 0 ? (
          <div className="py-10 text-center text-ink-muted text-sm">
            No hay servicios aún. Crea el primero.
          </div>
        ) : (
          services.map((svc) => (
            <div key={svc.id}
              className={`flex items-center justify-between px-6 py-4 transition-opacity
                ${svc.isActive ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink">{svc.name}</p>
                  {!svc.isActive && (
                    <span className="text-[10px] tracking-widest uppercase bg-gray-100 text-gray-400 px-2 py-0.5">
                      Inactivo
                    </span>
                  )}
                </div>
                {svc.description && (
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{svc.description}</p>
                )}
              </div>

              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-gold font-medium text-sm">{formatPrice(svc.price)}</p>
                  <p className="text-xs text-ink-muted">{svc.durationMinutes} min</p>
                </div>

                <button
                  onClick={() => openEdit(svc)}
                  className="text-xs text-ink-muted hover:text-gold transition-colors"
                >
                  Editar
                </button>

                <button
                  onClick={() => toggleActive(svc)}
                  className={`text-xs transition-colors ${
                    svc.isActive
                      ? 'text-ink-muted hover:text-red-500'
                      : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  {svc.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
