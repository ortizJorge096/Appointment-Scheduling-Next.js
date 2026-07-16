'use client'
// src/components/admin/CategoriesManager.tsx
// Categories CRUD for /admin/servicios → "Categorías" tab.
// Create / edit / activate-deactivate / soft-delete. Deletion is blocked
// server-side when the category still has services.

import { useState } from 'react'
import { ICON_LABELS } from '@/lib/config'
import { Icon } from '@/components/public/ServiceIcons'
import { IconPicker } from '@/components/admin/IconPicker'
import { useFieldValidation } from '@/hooks/useFieldValidation'
import { SubmitButton } from '@/components/ui/SubmitButton'

export interface AdminCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  order: number
  isActive: boolean
  _count: { services: number }
}

interface FormState {
  name: string
  description: string
  icon: string
  order: number
}

// Validated on blur and on submit. Module-level so the hook keeps a stable ref.
const CAT_FIELDS = ['name'] as const

const EMPTY: FormState = { name: '', description: '', icon: 'promo', order: 0 }

export default function CategoriesManager({
  categories,
  reload,
  onError,
  onSuccess,
}: {
  categories: AdminCategory[]
  reload: () => void
  onError: (msg: string | null) => void
  onSuccess: (msg: string) => void
}) {
  const [editing, setEditing] = useState<AdminCategory | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const v = useFieldValidation(CAT_FIELDS, (k) =>
    k === 'name' && form.name.trim().length < 2 ? 'El nombre debe tener al menos 2 caracteres' : undefined
  )

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, order: (categories.at(-1)?.order ?? 0) + 1 })
    setShowForm(true)
    v.reset()
    onError(null)
  }

  function openEdit(cat: AdminCategory) {
    setEditing(cat)
    setForm({ name: cat.name, description: cat.description ?? '', icon: cat.icon, order: cat.order })
    setShowForm(true)
    v.reset()
    onError(null)
  }

  async function handleSave() {
    if (Object.keys(v.validateAll()).length > 0) return

    setSaving(true)
    onError(null)

    const url    = editing ? `/api/categories/${editing.id}` : '/api/categories'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        icon: form.icon,
        order: form.order,
      }),
    })
    const json = await res.json()

    if (json.success) {
      setShowForm(false)
      onSuccess(editing ? 'Categoría actualizada' : 'Categoría creada')
      reload()
    } else {
      onError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function toggleActive(cat: AdminCategory) {
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !cat.isActive }),
    })
    const json = await res.json()
    if (json.success) { onSuccess(cat.isActive ? 'Categoría desactivada' : 'Categoría activada'); reload() }
    else onError(json.error)
  }

  async function handleDelete(cat: AdminCategory) {
    if (cat._count.services > 0) {
      onError(`Esta categoría tiene ${cat._count.services} servicio${cat._count.services === 1 ? '' : 's'}. Reasigna o elimina los servicios primero.`)
      return
    }
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Se ocultará del catálogo y del flujo de agendamiento.`)) return

    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { onSuccess('Categoría eliminada'); reload() }
    else onError(json.error ?? 'No se pudo eliminar')
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openNew} className="btn-primary text-sm">+ Nueva categoría</button>
      </div>

      {/* Inline modal form */}
      {showForm && (
        <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 animate-fade-in">
          <h2 className="font-serif text-xl text-ink font-light mb-6">
            {editing ? 'Editar categoría' : 'Nueva categoría'}
          </h2>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label htmlFor="cat-nombre" className="form-label">Nombre *</label>
              <input id="cat-nombre" type="text"
                className={`input-field ${v.errorOf('name') ? 'input-error' : ''}`}
                value={form.name}
                onChange={(e) => { setForm({ ...form, name: e.target.value }); v.clearError('name') }}
                onBlur={v.handleBlur('name')}
                placeholder="Ej: Uñas" />
              {v.errorOf('name') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('name')}</p>}
            </div>

            <div>
              <label className="form-label">Descripción</label>
              <textarea className="input-field resize-none" rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Breve descripción que verá el cliente en el flujo de reserva" />
            </div>

            <div>
              <label className="form-label">Ícono — {ICON_LABELS[form.icon as keyof typeof ICON_LABELS] ?? form.icon}</label>
              <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
            </div>

            <div className="sm:max-w-[200px]">
              <label className="form-label">Orden de aparición</label>
              <input type="number" className="input-field" min={0}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <SubmitButton onClick={handleSave} loading={saving} loadingLabel="Guardando…" className="btn-primary">
              Guardar
            </SubmitButton>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
        {categories.length === 0 ? (
          <div className="py-10 text-center text-ink-muted-deep text-sm">
            No hay categorías aún. Crea la primera.
          </div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {categories.map((cat) => (
              <div key={cat.id}
                className={`flex items-center justify-between px-4 sm:px-6 py-4 transition-opacity ${cat.isActive ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3 min-w-0 mr-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gold-pale text-gold-deep shrink-0">
                    <Icon name={cat.icon} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink">{cat.name}</p>
                      {!cat.isActive && (
                        <span className="text-2xs tracking-widest uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Inactiva</span>
                      )}
                    </div>
                    {cat.description && <p className="text-xs text-ink-muted-deep mt-0.5 truncate">{cat.description}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                  <span className="text-xs text-ink-muted-deep whitespace-nowrap">
                    {cat._count.services} servicio{cat._count.services === 1 ? '' : 's'}
                  </span>
                  <button onClick={() => openEdit(cat)} className="btn-row-action text-xs text-ink-muted-deep hover:text-gold-deep">Editar</button>
                  <button onClick={() => toggleActive(cat)}
                    className={`btn-row-action text-xs ${cat.isActive ? 'text-ink-muted-deep hover:text-amber-600' : 'text-green-700 hover:text-green-700'}`}>
                    {cat.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(cat)}
                    className={`btn-row-action text-xs ${cat._count.services > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-ink-muted-deep hover:text-red-700'}`}
                    title={cat._count.services > 0 ? 'Tiene servicios asociados' : 'Eliminar'}>
                    Eliminar
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
