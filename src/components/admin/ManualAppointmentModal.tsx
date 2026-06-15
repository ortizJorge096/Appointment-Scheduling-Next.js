'use client'
// src/components/admin/ManualAppointmentModal.tsx
// Modal para crear una cita manual desde el panel admin

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Service { id: string; name: string; price: number; durationMinutes: number }

const SOURCE_OPTIONS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'WHATSAPP',   label: 'WhatsApp' },
  { value: 'TELEFONO',   label: 'Teléfono' },
  { value: 'ONLINE',     label: 'Online' },
]

const EMPTY = {
  clientName: '', clientEmail: '', clientPhone: '',
  serviceId: '', date: '', startTime: '',
  source: 'PRESENCIAL', notes: '',
  skipAvailabilityCheck: false,
}

export default function ManualAppointmentModal() {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const loadServices = useCallback(async () => {
    const res = await fetch('/api/services')
    const j = await res.json()
    if (j.success) setServices(j.data)
  }, [])

  useEffect(() => { if (open) loadServices() }, [open, loadServices])

  function field(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')

    const res = await fetch('/api/appointments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        skipAvailabilityCheck: form.skipAvailabilityCheck,
      }),
    })
    const j = await res.json()
    setSaving(false)

    if (!j.success) { setError(j.error ?? 'Error al crear la cita'); return }

    setSuccess('Cita creada correctamente ✓')
    setForm(EMPTY)
    setTimeout(() => {
      setOpen(false)
      setSuccess('')
      router.refresh()
    }, 1200)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        + Cita manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink">Nueva cita manual</h2>
              <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
            </div>

            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              {/* Datos del cliente */}
              <div>
                <p className="text-xs font-medium text-ink-mid uppercase tracking-wider mb-2">Cliente</p>
                <div className="space-y-2">
                  <input required value={form.clientName} onChange={field('clientName')}
                    placeholder="Nombre completo *"
                    className="input-field w-full" />
                  <input required type="email" value={form.clientEmail} onChange={field('clientEmail')}
                    placeholder="Email *"
                    className="input-field w-full" />
                  <input required value={form.clientPhone} onChange={field('clientPhone')}
                    placeholder="Teléfono *"
                    className="input-field w-full" />
                </div>
              </div>

              {/* Servicio + fecha + hora */}
              <div>
                <p className="text-xs font-medium text-ink-mid uppercase tracking-wider mb-2">Cita</p>
                <div className="space-y-2">
                  <select required value={form.serviceId} onChange={field('serviceId')}
                    className="input-field w-full bg-white">
                    <option value="">Selecciona un servicio *</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.durationMinutes} min
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input required type="date" value={form.date} onChange={field('date')}
                      className="input-field w-full" />
                    <input required type="time" value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value.slice(0,5) }))}
                      className="input-field w-full" />
                  </div>
                </div>
              </div>

              {/* Origen */}
              <div>
                <p className="text-xs font-medium text-ink-mid uppercase tracking-wider mb-2">Origen</p>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, source: opt.value }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        form.source === opt.value
                          ? 'bg-gold text-white border-gold'
                          : 'border-beige-dark text-ink-muted hover:border-gold/50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas */}
              <div>
                <textarea value={form.notes} onChange={field('notes')}
                  placeholder="Notas internas (opcional)"
                  rows={2}
                  className="input-field w-full resize-none" />
              </div>

              {/* Saltar validación */}
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                <input type="checkbox"
                  checked={form.skipAvailabilityCheck}
                  onChange={e => setForm(f => ({ ...f, skipAvailabilityCheck: e.target.checked }))}
                  className="rounded border-beige-dark text-gold focus:ring-gold/40" />
                Forzar aunque el horario esté ocupado
              </label>

              {error   && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="btn-outline flex-1">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Crear cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
