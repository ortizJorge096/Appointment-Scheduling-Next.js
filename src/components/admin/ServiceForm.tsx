'use client'
// src/components/admin/ServiceForm.tsx

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface ServiceData {
  name:            string
  description:     string
  price:           number
  durationMinutes: number
  order:           number
}

interface Props {
  initial?:  Partial<ServiceData>
  onSave:    (data: ServiceData) => Promise<void>
  onCancel:  () => void
  saving?:   boolean
}

export function ServiceForm({ initial, onSave, onCancel, saving }: Props) {
  const [form, setForm] = useState<ServiceData>({
    name:            initial?.name            ?? '',
    description:     initial?.description     ?? '',
    price:           initial?.price           ?? 0,
    durationMinutes: initial?.durationMinutes ?? 45,
    order:           initial?.order           ?? 0,
  })
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof ServiceData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (form.price <= 0)   { setError('El precio debe ser mayor a 0'); return }
    if (form.durationMinutes < 15) { setError('La duración mínima es 15 min'); return }
    await onSave(form)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2">{error}</div>
      )}

      <Input
        label="Nombre *"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Ej: Manicure en gel"
      />

      <div>
        <label className="form-label">Descripción</label>
        <textarea
          className="input-field resize-none"
          rows={2}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Descripción breve..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Precio COP *"
          type="number"
          min={0}
          step={1000}
          value={form.price || ''}
          onChange={(e) => set('price', parseInt(e.target.value) || 0)}
          placeholder="45000"
        />
        <Input
          label="Duración (min) *"
          type="number"
          min={15}
          step={15}
          value={form.durationMinutes || ''}
          onChange={(e) => set('durationMinutes', parseInt(e.target.value) || 0)}
        />
      </div>

      <Input
        label="Orden de aparición"
        type="number"
        min={0}
        value={form.order}
        onChange={(e) => set('order', parseInt(e.target.value) || 0)}
      />

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}
