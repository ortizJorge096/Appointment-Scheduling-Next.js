'use client'
// src/app/admin/testimonios/page.tsx
// Testimonials management: list/create/edit/soft-delete/toggle/reorder, plus a
// moderation tab for PENDING reviews (approve/reject/edit). Client submissions
// (source CLIENT) are a future feature — the moderation flow is ready for them.

import { useState, useEffect } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePermissionGuard } from '@/components/admin/usePermissionGuard'
import { useFieldValidation } from '@/hooks/useFieldValidation'

interface Testimonial {
  id: string
  clientName: string
  initials: string
  type: string
  text: string
  stars: number
  imageUrl: string | null
  imageKey: string | null
  isActive: boolean
  order: number
  source: 'ADMIN' | 'CLIENT'
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
}

type Tab = 'todos' | 'pendientes'
type Filter = 'all' | 'active' | 'inactive'

const TYPE_PRESETS = ['Cliente frecuente', 'Cliente VIP', 'Cliente habitual', 'Primera visita']
const MAX_TEXT = 200
const MAX_BYTES = 5 * 1024 * 1024

const STATUS_BADGE: Record<Testimonial['status'], string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING:  'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT:    'bg-gray-100 text-gray-600',
}
const STATUS_LABEL: Record<Testimonial['status'], string> = {
  APPROVED: 'Aprobado', PENDING: 'Pendiente', REJECTED: 'Rechazado', DRAFT: 'Borrador',
}

interface FormState {
  clientName: string
  typeValue: string   // a preset or '__custom__'
  typeCustom: string
  text: string
  stars: number
  imageUrl: string | null
  imageKey: string | null
  isActive: boolean
}

// Validated on blur and on submit, in display order. 'type' covers the preset
// select and its custom free-text twin, which are one field to the user.
const T_FIELDS = ['clientName', 'type', 'text'] as const

const EMPTY: FormState = {
  clientName: '', typeValue: TYPE_PRESETS[0], typeCustom: '', text: '', stars: 5,
  imageUrl: null, imageKey: null, isActive: true,
}

export default function TestimoniosPage() {
  usePermissionGuard('testimonios:ver')
  const confirm = useConfirm()
  const [items, setItems]     = useState<Testimonial[]>([])
  const [tab, setTab]         = useState<Tab>('todos')
  const [filter, setFilter]   = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [editing, setEditing]   = useState<Testimonial | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<FormState>(EMPTY)

  const v = useFieldValidation(T_FIELDS, (k) => {
    switch (k) {
      case 'clientName':
        return form.clientName.trim().length >= 2 ? undefined : 'El nombre es requerido'
      case 'type':
        return resolveType(form).length >= 2 ? undefined : 'El tipo de cliente es requerido'
      case 'text':
        return form.text.trim().length >= 5 ? undefined : 'El testimonio es muy corto'
    }
  })

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  function load() {
    setLoading(true)
    fetch('/api/testimonials?manage=true')
      .then((r) => r.json())
      .then((json) => { if (json.success) setItems(json.data) })
      .catch(() => setError('Error al cargar testimonios'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const pendientes = items.filter((t) => t.status === 'PENDING')
  const todos = items.filter((t) =>
    filter === 'active' ? t.isActive : filter === 'inactive' ? !t.isActive : true
  )

  function resolveType(f: FormState) {
    return f.typeValue === '__custom__' ? f.typeCustom.trim() : f.typeValue
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
    v.reset()
    setError(null)
  }

  function openEdit(t: Testimonial) {
    const isPreset = TYPE_PRESETS.includes(t.type)
    setEditing(t)
    setForm({
      clientName: t.clientName,
      typeValue:  isPreset ? t.type : '__custom__',
      typeCustom: isPreset ? '' : t.type,
      text:       t.text,
      stars:      t.stars,
      imageUrl:   t.imageUrl,
      imageKey:   t.imageKey,
      isActive:   t.isActive,
    })
    setShowForm(true)
    v.reset()
    setError(null)
  }

  async function handleImage(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Solo JPG, PNG o WebP'); return }
    if (file.size > MAX_BYTES) { setError('La imagen supera los 5 MB'); return }
    setUploading(true)
    setError(null)
    try {
      const r1 = await fetch('/api/testimonials/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      const j1 = await r1.json()
      if (!j1.success) { setError(j1.error ?? 'No se pudo iniciar la subida'); return }
      const put = await fetch(j1.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) { setError('Error al subir la imagen'); return }
      setForm((f) => ({ ...f, imageUrl: j1.data.publicUrl, imageKey: j1.data.key }))
    } catch {
      setError('Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (Object.keys(v.validateAll()).length > 0) return

    setSaving(true)
    setError(null)
    const url    = editing ? `/api/testimonials/${editing.id}` : '/api/testimonials'
    const method = editing ? 'PATCH' : 'POST'
    const body: Record<string, unknown> = {
      clientName: form.clientName.trim(),
      type: resolveType(form),
      text: form.text.trim(),
      stars: form.stars,
      imageUrl: form.imageUrl,
      imageKey: form.imageKey,
    }
    if (editing) body.isActive = form.isActive

    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (json.success) {
      setShowForm(false)
      flash(editing ? 'Testimonio actualizado' : 'Testimonio creado')
      load()
    } else {
      setError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function patch(t: Testimonial, data: Record<string, unknown>, okMsg: string) {
    const res  = await fetch(`/api/testimonials/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    const json = await res.json()
    if (json.success) { flash(okMsg); load() } else setError(json.error ?? 'Error')
  }

  async function toggleActive(t: Testimonial) {
    patch(t, { isActive: !t.isActive }, t.isActive ? 'Testimonio desactivado' : 'Testimonio activado')
  }

  async function approve(t: Testimonial) { patch(t, { status: 'APPROVED' }, 'Testimonio aprobado') }

  async function reject(t: Testimonial) {
    const reason = window.prompt('Motivo del rechazo (opcional, nota interna):') ?? ''
    patch(t, { status: 'REJECTED', rejectionReason: reason || null }, 'Testimonio rechazado')
  }

  async function handleDelete(t: Testimonial) {
    const ok = await confirm({
      message: `¿Eliminar el testimonio de "${t.clientName}"? Desaparecerá del sitio (las citas/historial no se afectan).`,
      confirmLabel: 'Eliminar', danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/testimonials/${t.id}`, { method: 'DELETE' })
    if ((await res.json()).success) { flash('Testimonio eliminado'); load() } else setError('No se pudo eliminar')
  }

  async function move(t: Testimonial, dir: -1 | 1) {
    const sorted = [...todos].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((x) => x.id === t.id)
    const swap = sorted[idx + dir]
    if (!swap) return
    await Promise.all([
      fetch(`/api/testimonials/${t.id}`,    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: swap.order }) }),
      fetch(`/api/testimonials/${swap.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: t.order }) }),
    ])
    load()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Contenido</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Testimonios</h1>
        </div>
        <button onClick={openNew} className="btn-primary text-sm shrink-0">+ Agregar testimonio</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-beige-dark mb-6">
        {([['todos', 'Todos'], ['pendientes', 'Pendientes']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setError(null) }}
            className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-gold text-ink' : 'border-transparent text-ink-muted-deep hover:text-ink'
            }`}>
            {label}
            {t === 'pendientes' && pendientes.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-semibold">
                {pendientes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-5">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 animate-fade-in">
          <h2 className="font-serif text-xl text-ink font-light mb-6">{editing ? 'Editar testimonio' : 'Nuevo testimonio'}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="t-nombre" className="form-label">Nombre del cliente *</label>
              <input id="t-nombre" type="text" value={form.clientName}
                className={`input-field ${v.errorOf('clientName') ? 'border-red-400 focus:ring-red-300' : ''}`}
                onChange={(e) => { setForm({ ...form, clientName: e.target.value }); v.clearError('clientName') }}
                onBlur={v.handleBlur('clientName')}
                placeholder="Ej: Carmen Morales" />
              {v.errorOf('clientName')
                ? <p className="text-xs text-red-700 mt-0.5">{v.errorOf('clientName')}</p>
                : <p className="text-xs text-ink-muted-deep mt-1">Las iniciales se generan solas.</p>}
            </div>

            <div>
              <label htmlFor="t-tipo" className="form-label">Tipo de cliente *</label>
              <select id="t-tipo" value={form.typeValue}
                className={`select-field ${v.errorOf('type') ? 'border-red-400 focus:ring-red-300' : ''}`}
                onChange={(e) => { setForm({ ...form, typeValue: e.target.value }); v.clearError('type') }}
                onBlur={v.handleBlur('type')}>
                {TYPE_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="__custom__">Personalizado…</option>
              </select>
              {form.typeValue === '__custom__' && (
                <input type="text" className="input-field mt-2" value={form.typeCustom}
                  onChange={(e) => { setForm({ ...form, typeCustom: e.target.value }); v.clearError('type') }}
                  onBlur={v.handleBlur('type')}
                  aria-label="Tipo de cliente personalizado"
                  placeholder="Escribe el tipo" />
              )}
              {v.errorOf('type') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('type')}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="t-texto" className="form-label">Testimonio *</label>
              <textarea id="t-texto" rows={3} maxLength={MAX_TEXT}
                className={`input-field resize-none ${v.errorOf('text') ? 'border-red-400 focus:ring-red-300' : ''}`}
                value={form.text}
                onChange={(e) => { setForm({ ...form, text: e.target.value }); v.clearError('text') }}
                onBlur={v.handleBlur('text')}
                placeholder="Lo que dijo el cliente…" />
              <div className="flex justify-between gap-2 mt-1">
                <p className="text-xs text-red-700">{v.errorOf('text')}</p>
                <p className="text-xs text-ink-muted-deep text-right shrink-0">{form.text.length}/{MAX_TEXT}</p>
              </div>
            </div>

            <div>
              <label className="form-label">Calificación</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, stars: n })}
                    className={`text-2xl leading-none transition-colors ${n <= form.stars ? 'text-gold-deep' : 'text-beige-dark'}`}
                    aria-label={`${n} estrellas`}>★</button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Foto del trabajo (opcional)</label>
              {form.imageUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-beige-dark" />
                  <button type="button" onClick={() => setForm({ ...form, imageUrl: null, imageKey: null })}
                    className="text-xs text-ink-muted-deep hover:text-red-700">Quitar imagen</button>
                </div>
              ) : (
                <label className={`btn-secondary text-sm cursor-pointer inline-block ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploading ? 'Subiendo…' : 'Subir imagen'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
                </label>
              )}
            </div>

            {editing && (
              <div className="flex items-center gap-2">
                <input id="t-active" type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="t-active" className="text-sm text-ink-muted-deep">Activo (visible en el sitio)</label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-5">
            <button onClick={handleSave} disabled={saving || uploading} className="btn-primary">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filter (only on "Todos") */}
      {tab === 'todos' && (
        <div className="flex gap-2 mb-4">
          {([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos']] as [Filter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f ? 'border-gold bg-gold-pale text-gold-deep' : 'border-beige-dark text-ink-muted-deep hover:border-gold/50'
              }`}>{label}</button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-ink-muted-deep text-sm">Cargando...</div>
        ) : tab === 'pendientes' ? (
          pendientes.length === 0 ? (
            <div className="py-10 text-center text-ink-muted-deep text-sm">No hay reseñas pendientes de moderación.</div>
          ) : (
            <div className="divide-y divide-beige-dark">
              {pendientes.map((t) => (
                <div key={t.id} className="px-4 sm:px-6 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{t.clientName} <span className="text-ink-muted-deep text-xs">· {t.type}</span></p>
                      <p className="text-sm text-ink-muted-deep mt-1">&ldquo;{t.text}&rdquo;</p>
                      <p className="text-gold-deep text-xs mt-1">{'★'.repeat(t.stars)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button onClick={() => approve(t)} className="btn-row-action text-xs text-green-700 hover:text-green-700">Aprobar</button>
                      <button onClick={() => reject(t)} className="btn-row-action text-xs text-ink-muted-deep hover:text-red-700">Rechazar</button>
                      <button onClick={() => openEdit(t)} className="btn-row-action text-xs text-ink-muted-deep hover:text-gold-deep">Editar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : todos.length === 0 ? (
          <div className="py-10 text-center text-ink-muted-deep text-sm">No hay testimonios aún. Agrega el primero.</div>
        ) : (
          <div className="divide-y divide-beige-dark">
            {[...todos].sort((a, b) => a.order - b.order).map((t, idx, arr) => (
              <div key={t.id} className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 ${t.isActive ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  {t.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg border border-beige-dark shrink-0" />
                  ) : (
                    <span className="w-12 h-12 rounded-lg bg-gold-pale text-gold-deep flex items-center justify-center font-serif text-sm shrink-0">{t.initials}</span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink truncate">{t.clientName}</p>
                      <span className="text-[10px] tracking-widest uppercase bg-gold-pale text-gold-deep px-2 py-0.5 rounded-full">{t.type}</span>
                      <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      {t.source === 'CLIENT' && <span className="text-[10px] tracking-widest uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Cliente</span>}
                    </div>
                    <p className="text-xs text-ink-muted-deep mt-0.5 truncate">{t.text.slice(0, 60)}{t.text.length > 60 ? '…' : ''} · {'★'.repeat(t.stars)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="flex flex-col">
                    <button disabled={idx === 0} onClick={() => move(t, -1)} className="text-xs text-ink-muted-deep hover:text-gold-deep disabled:opacity-20 leading-none">↑</button>
                    <button disabled={idx === arr.length - 1} onClick={() => move(t, 1)} className="text-xs text-ink-muted-deep hover:text-gold-deep disabled:opacity-20 leading-none">↓</button>
                  </div>
                  <button onClick={() => openEdit(t)} className="btn-row-action text-xs text-ink-muted-deep hover:text-gold-deep">Editar</button>
                  <button onClick={() => toggleActive(t)}
                    className={`btn-row-action text-xs ${t.isActive ? 'text-ink-muted-deep hover:text-amber-600' : 'text-green-700 hover:text-green-700'}`}>
                    {t.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(t)} className="btn-row-action text-xs text-ink-muted-deep hover:text-red-700">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
