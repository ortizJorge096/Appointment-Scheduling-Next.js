'use client'
// src/components/admin/BookingSettingsCard.tsx
// Lets the admin toggle whether /agendar shows the professional-selection
// step. When off, the booking form never sends professionalId — the
// existing "Primera disponible" auto-assignment already covers that case.

import { useState, useEffect } from 'react'

export default function BookingSettingsCard() {
  const [showProfessionalStep, setShowProfessionalStep] = useState(false)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(90)
  const [maxAdvanceInput, setMaxAdvanceInput] = useState('90')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [savingDays, setSavingDays] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/booking-settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setShowProfessionalStep(json.data.showProfessionalStep)
          if (typeof json.data.maxAdvanceDays === 'number') {
            setMaxAdvanceDays(json.data.maxAdvanceDays)
            setMaxAdvanceInput(String(json.data.maxAdvanceDays))
          }
        }
      })
      .catch(() => setError('No se pudo cargar la configuración de agendamiento'))
      .finally(() => setLoading(false))
  }, [])

  function flashSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  async function saveMaxAdvance() {
    const value = parseInt(maxAdvanceInput, 10)
    if (isNaN(value) || value < 7 || value > 365) {
      setError('La anticipación debe estar entre 7 y 365 días')
      return
    }
    if (value === maxAdvanceDays) return
    setSavingDays(true)
    setError(null)
    const res = await fetch('/api/booking-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxAdvanceDays: value }),
    })
    const json = await res.json()
    if (json.success) {
      setMaxAdvanceDays(value)
      flashSuccess('Configuración actualizada')
    } else {
      setError(json.error ?? 'Error al guardar')
    }
    setSavingDays(false)
  }

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
    return <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 text-sm text-ink-muted-deep">Cargando configuración de agendamiento...</div>
  }

  return (
    <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Regla de negocio</p>
          <h2 className="font-serif text-xl text-ink">Selección de profesional en /agendar</h2>
          <p className="text-sm text-ink-muted-deep mt-1">
            Permitir que el cliente elija profesional. Si está desactivado, el sistema asignará
            el profesional automáticamente (primera disponible, según el orden configurado abajo).
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="text-sm text-ink-muted-deep">{showProfessionalStep ? 'Activo' : 'Inactivo'}</span>
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

      {/* Booking horizon */}
      <div className="border-t border-beige-dark mt-5 pt-5">
        <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Ventana de reserva</p>
        <h2 className="font-serif text-xl text-ink">¿Con cuántos días de anticipación pueden agendar?</h2>
        <p className="text-sm text-ink-muted-deep mt-1 mb-3">
          Los clientes podrán ver disponibilidad hasta {maxAdvanceDays} días en el futuro.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="number" min={7} max={365}
            className="input-field !w-28"
            value={maxAdvanceInput}
            onChange={(e) => setMaxAdvanceInput(e.target.value)}
          />
          <span className="text-sm text-ink-muted-deep">días (7–365)</span>
          <button
            onClick={saveMaxAdvance}
            disabled={savingDays || maxAdvanceInput === String(maxAdvanceDays)}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {savingDays ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mt-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mt-4">✓ {success}</div>}
    </div>
  )
}
