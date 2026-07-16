'use client'
// src/components/admin/VipDiscountConfigCard.tsx
// Lets the admin edit the VIP multi-service discount rule without touching code:
// turn the rule on/off, and edit how many services unlock each discount tier.

import { useState, useEffect } from 'react'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

interface Tier {
  minServices: number
  discountPct: number
}

export default function VipDiscountConfigCard() {
  const [enabled, setEnabled] = useState(true)
  const [tiers, setTiers]     = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/vip-config')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setEnabled(json.data.enabled)
          setTiers(json.data.tiers)
        }
      })
      .catch(() => setError('No se pudo cargar la configuración VIP'))
      .finally(() => setLoading(false))
  }, [])

  function updateTier(i: number, field: keyof Tier, value: number) {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function addTier() {
    const last = tiers[tiers.length - 1]
    setTiers((prev) => [...prev, { minServices: (last?.minServices ?? 1) + 1, discountPct: (last?.discountPct ?? 0) + 10 }])
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    const res = await fetch('/api/vip-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, tiers }),
    })
    const json = await res.json()
    if (json.success) {
      setTiers(json.data.tiers)
      setSuccess('Configuración VIP actualizada')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(json.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8 text-sm text-ink-muted-deep">Cargando configuración VIP...</div>
  }

  return (
    <div className="bg-white border border-beige-dark rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Regla de negocio</p>
          <h2 className="font-serif text-xl text-ink">Descuento VIP por múltiples servicios</h2>
          <p className="text-sm text-ink-muted-deep mt-1">
            Se aplica automáticamente cuando el cliente agenda 2 o más servicios (de cualquier categoría) en la misma cita.
          </p>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={() => setEnabled((v) => !v)}
          label="Descuento VIP por múltiples servicios"
        />
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-4">✓ {success}</div>}

      <div className="space-y-2 mb-4">
        {tiers
          .sort((a, b) => a.minServices - b.minServices)
          .map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-y-2 gap-x-2 sm:gap-3 bg-beige/40 rounded-lg px-4 py-2.5">
            <span className="text-sm text-ink-muted-deep whitespace-nowrap">
              <span className="sm:hidden">Desde</span>
              <span className="hidden sm:inline">A partir de</span>
            </span>
            <input type="number" min={2} max={20} value={t.minServices}
              onChange={(e) => updateTier(i, 'minServices', parseInt(e.target.value) || 2)}
              className="input-field w-16 sm:w-20 py-1.5 text-center" />
            <span className="text-sm text-ink-muted-deep whitespace-nowrap">
              <span className="sm:hidden">serv. →</span>
              <span className="hidden sm:inline">servicios →</span>
            </span>
            <input type="number" min={0} max={100} value={t.discountPct}
              onChange={(e) => updateTier(i, 'discountPct', parseInt(e.target.value) || 0)}
              className="input-field w-16 sm:w-20 py-1.5 text-center" />
            <span className="text-sm text-ink-muted-deep whitespace-nowrap">
              <span className="sm:hidden">% desc.</span>
              <span className="hidden sm:inline">% de descuento</span>
            </span>
            <button onClick={() => removeTier(i)}
              className="btn-row-action ml-auto text-xs text-ink-muted-deep hover:text-red-700">
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={addTier} className="btn-secondary text-sm">+ Añadir tramo</button>
        <SubmitButton onClick={handleSave} loading={saving} loadingLabel="Guardando…" className="btn-primary text-sm">
          Guardar configuración VIP
        </SubmitButton>
      </div>
    </div>
  )
}
