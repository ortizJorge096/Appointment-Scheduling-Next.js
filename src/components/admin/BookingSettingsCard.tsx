'use client'
// src/components/admin/BookingSettingsCard.tsx
// Lets the admin toggle whether /agendar shows the professional-selection
// step. When off, the booking form never sends professionalId — the
// existing "Primera disponible" auto-assignment already covers that case.

import { useState, useEffect } from 'react'

export default function BookingSettingsCard() {
  const [showProfessionalStep, setShowProfessionalStep] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/booking-settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setShowProfessionalStep(json.data.showProfessionalStep)
      })
      .catch(() => setError('No se pudo cargar la configuración de agendamiento'))
      .finally(() => setLoading(false))
  }, [])

  async function toggle() {
    const next = !showProfessionalStep
    setShowProfessionalStep(next)
    setSaving(true)
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/booking-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showProfessionalStep: next }),
    })
    const json = await res.json()
    if (json.success) {
      setSuccess('Configuración actualizada')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setShowProfessionalStep(!next) // revert on failure
      setError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 text-sm text-ink-muted">Cargando configuración de agendamiento...</div>
  }

  return (
    <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Regla de negocio</p>
          <h2 className="font-serif text-xl text-ink">Selección de profesional en /agendar</h2>
          <p className="text-sm text-ink-muted mt-1">
            Permitir que el cliente elija profesional. Si está desactivado, el sistema asignará
            el profesional automáticamente (primera disponible, según el orden configurado abajo).
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="text-sm text-ink-muted">{showProfessionalStep ? 'Activo' : 'Inactivo'}</span>
          <span
            onClick={toggle}
            className={`w-11 h-6 rounded-full relative transition-colors ${
              showProfessionalStep ? 'bg-gold' : 'bg-beige-dark'
            } ${saving ? 'opacity-60' : ''}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              showProfessionalStep ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </span>
        </label>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mt-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mt-4">✓ {success}</div>}
    </div>
  )
}
