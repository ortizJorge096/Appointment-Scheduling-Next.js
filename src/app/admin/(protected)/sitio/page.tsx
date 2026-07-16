'use client'
// src/app/admin/sitio/page.tsx
// Edits the marketing metrics shown on the public Home (Hero + Nosotros).
// servicesCount is read-only — it is derived live from the active catalog.

import { useState, useEffect } from 'react'
import { usePermissionGuard } from '@/components/admin/usePermissionGuard'
import { PageHeader } from '@/components/ui/PageHeader'

interface Form {
  appointmentsCount: number
  clientsCount: number
  yearsExperience: number
  rating: number
}

export default function SitioPage() {
  usePermissionGuard('configuracion:ver')
  const [form, setForm]           = useState<Form | null>(null)
  const [servicesCount, setServicesCount] = useState<number | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/landing-stats')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setForm({
            appointmentsCount: json.data.appointmentsCount,
            clientsCount:      json.data.clientsCount,
            yearsExperience:   json.data.yearsExperience,
            rating:            json.data.rating,
          })
          setServicesCount(json.data.servicesCount)
        }
      })
      .catch(() => setError('Error al cargar las métricas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleSave() {
    if (!form) return
    if (form.rating < 0 || form.rating > 5) { setError('La calificación debe estar entre 0 y 5'); return }

    setSaving(true)
    setError(null)

    const res  = await fetch('/api/landing-stats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()

    if (json.success) {
      setServicesCount(json.data.servicesCount)
      setSuccess('Métricas actualizadas')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  function set<K extends keyof Form>(key: K, value: number) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <PageHeader className="mb-6 sm:mb-8" eyebrow="Contenido" title="Métricas del sitio"
        subtitle="Indicadores que se muestran en el inicio (Hero y sección Nosotros)." />

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-5">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {loading || !form ? (
        <div className="py-10 text-center text-ink-muted-deep text-sm">Cargando...</div>
      ) : (
        <div className="bg-white border border-beige-dark rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Citas realizadas</label>
              <input type="number" className="input-field" min={0}
                value={form.appointmentsCount || ''}
                onChange={(e) => set('appointmentsCount', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-ink-muted-deep mt-1">Se muestra como “+{form.appointmentsCount}”.</p>
            </div>

            <div>
              <label className="form-label">Personas satisfechas</label>
              <input type="number" className="input-field" min={0}
                value={form.clientsCount || ''}
                onChange={(e) => set('clientsCount', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-ink-muted-deep mt-1">Se muestra como “+{form.clientsCount}”.</p>
            </div>

            <div>
              <label className="form-label">Años de experiencia</label>
              <input type="number" className="input-field" min={0}
                value={form.yearsExperience || ''}
                onChange={(e) => set('yearsExperience', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-ink-muted-deep mt-1">Se muestra como “+{form.yearsExperience}”.</p>
            </div>

            <div>
              <label className="form-label">Calificación (0–5)</label>
              <input type="number" className="input-field" min={0} max={5} step={0.1}
                value={form.rating || ''}
                onChange={(e) => set('rating', parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-ink-muted-deep mt-1">Se muestra como “{form.rating}★”.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Servicios disponibles</label>
              <input type="text" className="input-field bg-beige/40 text-ink-muted-deep cursor-not-allowed"
                value={servicesCount ?? '—'} disabled />
              <p className="text-xs text-ink-muted-deep mt-1">
                Se calcula automáticamente con los servicios activos del catálogo. No es editable.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
