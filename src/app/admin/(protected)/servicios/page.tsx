'use client'
// src/app/admin/servicios/page.tsx
// Services CRUD — create, edit, activate/deactivate

import { useState, useEffect } from 'react'
import { CATEGORY_ORDER, categoryLabel } from '@/lib/config'
import { Pagination } from '@/components/admin/Pagination'
import { formatPrice } from '@/lib/utils'
import VipDiscountConfigCard from '@/components/admin/VipDiscountConfigCard'
import { CategoryIcon } from '@/components/public/ServiceIcons'

const PER_PAGE = 8

interface Service {
  id: string
  name: string
  description: string | null
  category: string
  price: number
  durationMinutes: number
  isActive: boolean
  order: number
}

const EMPTY: Omit<Service, 'id' | 'isActive'> = {
  name: '', description: '', category: 'UNAS', price: 0, durationMinutes: 45, order: 0,
}


export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  // Form
  const [editing, setEditing]   = useState<Service | null>(null)   // null = new
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [page, setPage]         = useState(1)

  // null = showing the category grid; a category key = drilled into that category's services
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = CATEGORY_ORDER.map((cat) => ({
    cat,
    services: services.filter((s) => s.category === cat),
  }))

  const categoryServices = selectedCategory
    ? services.filter((s) => s.category === selectedCategory)
    : []
  const totalPages = Math.ceil(categoryServices.length / PER_PAGE)
  const paged       = categoryServices.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function openCategory(cat: string) {
    setSelectedCategory(cat)
    setPage(1)
  }

  function load() {
    fetch('/api/services')
      .then((r) => r.json())
      .then((json) => { if (json.success) setServices(json.data) })
      .catch(() => setError('Error al cargar servicios'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, category: selectedCategory ?? EMPTY.category })
    setShowForm(true)
    setError(null)
  }

  function openEdit(svc: Service) {
    setEditing(svc)
    setForm({
      name: svc.name,
      description: svc.description ?? '',
      category: svc.category ?? 'UNAS',
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Catálogo</p>
          {selectedCategory ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedCategory(null)}
                className="text-xs text-ink-muted hover:text-gold transition-colors">
                ← Categorías
              </button>
              <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">
                {categoryLabel(selectedCategory)}
              </h1>
            </div>
          ) : (
            <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Servicios</h1>
          )}
        </div>
        {selectedCategory && (
          <button onClick={openNew} className="btn-primary text-sm">+ Nuevo</button>
        )}
      </div>

      {/* Messages */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-5">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {!selectedCategory && <VipDiscountConfigCard />}

      {/* Inline modal form */}
      {showForm && (
        <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 animate-fade-in">
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

            <div className="sm:col-span-2">
              <label className="form-label">Categoría *</label>
              <select className="select-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                ))}
              </select>
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

      {/* Category grid — entry point */}
      {!selectedCategory && (
        loading ? (
          <div className="py-10 text-center text-ink-muted text-sm">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(({ cat, services: svcs }) => {
              const activeCount = svcs.filter((s) => s.isActive).length
              return (
                <button key={cat} type="button" onClick={() => openCategory(cat)}
                  className="text-left p-6 rounded-xl border border-beige-dark bg-white transition-all duration-200
                             hover:border-gold/50 hover:shadow-lg hover:-translate-y-0.5">
                  <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 bg-gold-pale text-gold-dark">
                    <CategoryIcon category={cat} className="w-7 h-7" />
                  </span>
                  <p className="font-serif text-xl text-ink">{categoryLabel(cat)}</p>
                  <p className="text-sm text-ink-muted leading-snug mt-1.5">
                    {svcs.length} servicio{svcs.length === 1 ? '' : 's'}
                    {svcs.length > 0 && <> · {activeCount} activo{activeCount === 1 ? '' : 's'}</>}
                  </p>
                </button>
              )
            })}
          </div>
        )
      )}

      {/* List — services within the selected category */}
      {selectedCategory && (
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-ink-muted text-sm">Cargando...</div>
        ) : categoryServices.length === 0 ? (
          <div className="py-10 text-center text-ink-muted text-sm">
            No hay servicios en esta categoría aún. Crea el primero.
          </div>
        ) : (
          <>
            <div className="divide-y divide-beige-dark hidden md:block">
              {paged.map((svc) => (
                <div key={svc.id}
                  className={`flex items-center justify-between px-6 py-4 transition-opacity
                    ${svc.isActive ? '' : 'opacity-50'}`}>
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink">{svc.name}</p>
                      <span className="text-[10px] tracking-widest uppercase bg-gold-pale text-gold-dark px-2 py-0.5 rounded-full">
                        {categoryLabel(svc.category)}
                      </span>
                      {!svc.isActive && (
                        <span className="text-[10px] tracking-widest uppercase bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {svc.description && (
                      <p className="text-xs text-ink-muted mt-0.5 truncate">{svc.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <p className="text-gold font-medium text-sm">{formatPrice(svc.price)}</p>
                      <p className="text-xs text-ink-muted">{svc.durationMinutes} min</p>
                    </div>

                    <button
                      onClick={() => openEdit(svc)}
                      className="btn-row-action text-xs text-ink-muted hover:text-gold"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => toggleActive(svc)}
                      className={`btn-row-action text-xs ${
                        svc.isActive
                          ? 'text-ink-muted hover:text-red-500'
                          : 'text-green-600 hover:text-green-700'
                      }`}
                    >
                      {svc.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-beige-dark">
              {paged.map((svc) => (
                <div key={svc.id} className={`px-4 py-3 transition-opacity ${svc.isActive ? '' : 'opacity-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-ink text-sm truncate">{svc.name}</p>
                      <span className="text-[10px] tracking-widest uppercase bg-gold-pale text-gold-dark px-2 py-0.5 rounded-full shrink-0">
                        {categoryLabel(svc.category)}
                      </span>
                    </div>
                    <p className="text-gold font-medium text-sm shrink-0">{formatPrice(svc.price)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-ink-muted">{svc.durationMinutes} min</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(svc)} className="btn-row-action text-xs text-ink-muted hover:text-gold">Editar</button>
                      <button onClick={() => toggleActive(svc)}
                        className={`btn-row-action text-xs ${svc.isActive ? 'text-ink-muted hover:text-red-500' : 'text-green-600 hover:text-green-700'}`}>
                        {svc.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {selectedCategory && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}

    </div>
  )
}
