'use client'
// src/app/admin/servicios/page.tsx
// Catalog: "Servicios" and "Categorías" tabs.
// Services tab: create, edit, activate/deactivate, delete (soft delete).
// Categories tab: managed in CategoriesManager.

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/admin/Pagination'
import { formatPrice } from '@/lib/utils'
import VipDiscountConfigCard from '@/components/admin/VipDiscountConfigCard'
import { Icon } from '@/components/public/ServiceIcons'
import CategoriesManager, { type AdminCategory } from '@/components/admin/CategoriesManager'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePermissionGuard, useCan } from '@/components/admin/usePermissionGuard'

const PER_PAGE = 8

interface Service {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  category: { id: string; name: string; slug: string; icon: string; order: number } | null
  price: number
  durationMinutes: number
  isActive: boolean
  order: number
}

type Tab = 'servicios' | 'categorias'

interface ServiceForm {
  name: string
  description: string
  categoryId: string
  price: number
  durationMinutes: number
  order: number
}

const EMPTY_SERVICE: ServiceForm = {
  name: '', description: '', categoryId: '', price: 0, durationMinutes: 45, order: 0,
}

export default function ServiciosPage() {
  usePermissionGuard('servicios:ver')
  const can = useCan()
  const [tab, setTab]               = useState<Tab>('servicios')
  const [services, setServices]     = useState<Service[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)

  // Service form
  const [editing, setEditing]   = useState<Service | null>(null) // null = new
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<ServiceForm>(EMPTY_SERVICE)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')

  // null = category grid; a category id = drilled into that category's services
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/services?includeInactive=true').then((r) => r.json()),
      fetch('/api/categories?includeInactive=true').then((r) => r.json()),
    ])
      .then(([svcJson, catJson]) => {
        if (svcJson.success) setServices(svcJson.data)
        if (catJson.success) setCategories(catJson.data)
      })
      .catch(() => setError('Error al cargar el catálogo'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const selectedCat = categories.find((c) => c.id === selectedCategory) ?? null

  // Search overrides the category drill-in: show a flat matching list.
  const searching = search.trim().length > 0
  const searchResults = searching
    ? services.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : []

  const categoryServices = selectedCategory
    ? services.filter((s) => s.categoryId === selectedCategory)
    : []

  const listed = searching ? searchResults : categoryServices
  const totalPages = Math.ceil(listed.length / PER_PAGE)
  const paged = listed.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function openCategory(catId: string) {
    setSelectedCategory(catId)
    setPage(1)
  }

  function openNew() {
    setEditing(null)
    setForm({
      ...EMPTY_SERVICE,
      categoryId: selectedCategory ?? categories[0]?.id ?? '',
    })
    setShowForm(true)
    setError(null)
  }

  function openEdit(svc: Service) {
    setEditing(svc)
    setForm({
      name: svc.name,
      description: svc.description ?? '',
      categoryId: svc.categoryId ?? categories[0]?.id ?? '',
      price: svc.price,
      durationMinutes: svc.durationMinutes,
      order: svc.order,
    })
    setShowForm(true)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim())   { setError('El nombre es requerido'); return }
    if (!form.categoryId)    { setError('La categoría es requerida'); return }
    if (form.price <= 0)     { setError('El precio debe ser mayor a 0'); return }

    setSaving(true)
    setError(null)

    const url    = editing ? `/api/services/${editing.id}` : '/api/services'
    const method = editing ? 'PATCH' : 'POST'

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description || undefined,
        categoryId: form.categoryId,
        price: form.price,
        durationMinutes: form.durationMinutes,
        order: form.order,
      }),
    })
    const json = await res.json()

    if (json.success) {
      setShowForm(false)
      flash(editing ? 'Servicio actualizado' : 'Servicio creado')
      load()
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
    if (json.success) { flash(svc.isActive ? 'Servicio desactivado' : 'Servicio activado'); load() }
    else setError(json.error)
  }

  async function handleDelete(svc: Service) {
    if (!confirm(`¿Eliminar "${svc.name}"? Desaparecerá del flujo público; las citas históricas se conservan.`)) return
    const res  = await fetch(`/api/services/${svc.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { flash('Servicio eliminado'); load() }
    else setError(json.error ?? 'No se pudo eliminar')
  }

  function ServiceRow({ svc }: { svc: Service }) {
    return (
      <div className={`flex items-center justify-between px-4 sm:px-6 py-4 transition-opacity ${svc.isActive ? '' : 'opacity-50'}`}>
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-ink">{svc.name}</p>
            <span className="text-[10px] tracking-widest uppercase bg-gold-pale text-gold-deep px-2 py-0.5 rounded-full">
              {svc.category?.name ?? 'Sin categoría'}
            </span>
            {!svc.isActive && (
              <span className="text-[10px] tracking-widest uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactivo</span>
            )}
          </div>
          {svc.description && <p className="text-xs text-ink-muted-deep mt-0.5 truncate">{svc.description}</p>}
        </div>

        <div className="flex items-center gap-4 sm:gap-5 shrink-0">
          <div className="text-right">
            <p className="text-gold-deep font-medium text-sm">{formatPrice(svc.price)}</p>
            <p className="text-xs text-ink-muted-deep">{svc.durationMinutes} min</p>
          </div>
          {can('servicios:editar') && (<>
          <button onClick={() => openEdit(svc)} className="btn-row-action text-xs text-ink-muted-deep hover:text-gold-deep">Editar</button>
          <button onClick={() => toggleActive(svc)}
            className={`btn-row-action text-xs ${svc.isActive ? 'text-ink-muted-deep hover:text-amber-600' : 'text-green-700 hover:text-green-700'}`}>
            {svc.isActive ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={() => handleDelete(svc)} className="btn-row-action text-xs text-ink-muted-deep hover:text-red-700">Eliminar</button>
          </>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <PageHeader className="mb-6" eyebrow="Catálogo" title="Servicios y categorías" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-beige-dark mb-6">
        {(['servicios', 'categorias'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null) }}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-gold text-ink' : 'border-transparent text-ink-muted-deep hover:text-ink'
            }`}>
            {t === 'servicios' ? 'Servicios' : 'Categorías'}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-5">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {loading ? (
        <div className="py-10 text-center text-ink-muted-deep text-sm">Cargando...</div>
      ) : tab === 'categorias' ? (
        can('servicios:editar')
          ? <CategoriesManager categories={categories} reload={load} onError={setError} onSuccess={flash} />
          : <p className="text-sm text-ink-muted-deep py-6">No tienes permiso para gestionar categorías.</p>
      ) : (
        <>
          {/* Services toolbar */}
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {selectedCategory && !searching && (
                <button onClick={() => setSelectedCategory(null)}
                  className="text-xs text-ink-muted-deep hover:text-gold-deep transition-colors">← Categorías</button>
              )}
              <input type="search" placeholder="Buscar servicio…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="input-field !w-full sm:!w-auto sm:min-w-[200px]" />
            </div>
            {can('servicios:editar') && (
              <button onClick={openNew} className="btn-primary text-sm" disabled={categories.length === 0}>
                + Nuevo servicio
              </button>
            )}
          </div>

          {categories.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 mb-5">
              Crea al menos una categoría antes de agregar servicios.
            </div>
          )}

          {!selectedCategory && !searching && can('configuracion:editar') && <VipDiscountConfigCard />}

          {/* Service form */}
          {showForm && (
            <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 animate-fade-in">
              <h2 className="font-serif text-xl text-ink font-light mb-6">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="form-label">Nombre *</label>
                  <input type="text" className="input-field"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Manicure en gel" />
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label">Descripción</label>
                  <textarea className="input-field resize-none" rows={2}
                    value={form.description ?? ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripción breve del servicio" />
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label">Categoría *</label>
                  <select className="select-field"
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="" disabled>Selecciona una categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}{cat.isActive ? '' : ' (inactiva)'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Precio (COP) *</label>
                  <input type="number" className="input-field" min={0} step={1000}
                    value={form.price || ''}
                    onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                    placeholder="45000" />
                </div>

                <div>
                  <label className="form-label">Duración (minutos) *</label>
                  <input type="number" className="input-field" min={15} step={15}
                    value={form.durationMinutes || ''}
                    onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 0 })}
                    placeholder="60" />
                </div>

                <div>
                  <label className="form-label">Orden de aparición</label>
                  <input type="number" className="input-field" min={0}
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          )}

          {/* Category grid — entry point (hidden while searching) */}
          {!selectedCategory && !searching && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => {
                const svcs = services.filter((s) => s.categoryId === cat.id)
                const activeCount = svcs.filter((s) => s.isActive).length
                return (
                  <button key={cat.id} type="button" onClick={() => openCategory(cat.id)}
                    className={`text-left p-6 rounded-xl border border-beige-dark bg-white transition-all duration-200
                               hover:border-gold/50 hover:shadow-lg hover:-translate-y-0.5 ${cat.isActive ? '' : 'opacity-60'}`}>
                    <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 bg-gold-pale text-gold-deep">
                      <Icon name={cat.icon} className="w-7 h-7" />
                    </span>
                    <p className="font-serif text-xl text-ink">{cat.name}</p>
                    <p className="text-sm text-ink-muted-deep leading-snug mt-1.5">
                      {svcs.length} servicio{svcs.length === 1 ? '' : 's'}
                      {svcs.length > 0 && <> · {activeCount} activo{activeCount === 1 ? '' : 's'}</>}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Drilled-in category title */}
          {selectedCategory && !searching && selectedCat && (
            <h2 className="font-serif text-xl text-ink font-light mb-3">{selectedCat.name}</h2>
          )}

          {/* Service list (category drill-in or search results) */}
          {(selectedCategory || searching) && (
            <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
              {listed.length === 0 ? (
                <div className="py-10 text-center text-ink-muted-deep text-sm">
                  {searching ? 'Ningún servicio coincide con la búsqueda.' : 'No hay servicios en esta categoría aún. Crea el primero.'}
                </div>
              ) : (
                <div className="divide-y divide-beige-dark">
                  {paged.map((svc) => <ServiceRow key={svc.id} svc={svc} />)}
                </div>
              )}
            </div>
          )}

          {(selectedCategory || searching) && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </>
      )}
    </div>
  )
}
