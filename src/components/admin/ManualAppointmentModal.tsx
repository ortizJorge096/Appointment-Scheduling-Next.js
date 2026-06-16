'use client'
// src/components/admin/ManualAppointmentModal.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Service { id: string; name: string; price: number; durationMinutes: number }
interface ClientHit { id: string; name: string; email: string; phone: string | null }

const SOURCE_OPTIONS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'WHATSAPP',   label: 'WhatsApp'   },
  { value: 'TELEFONO',   label: 'Teléfono'   },
  { value: 'ONLINE',     label: 'Online'     },
]

const EMPTY = {
  clientName: '', clientEmail: '', clientPhone: '',
  serviceId: '', date: '', startTime: '',
  source: 'PRESENCIAL', notes: '',
  skipAvailabilityCheck: false,
}

type FieldErrors = Partial<Record<keyof typeof EMPTY, string>>

// Earliest date allowed for manual backfill: 15 days ago
const PAST_LIMIT_DAYS = 15
function minManualDate() {
  const d = new Date()
  d.setDate(d.getDate() - PAST_LIMIT_DAYS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ManualAppointmentModal() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [form, setForm]         = useState(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving]     = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess]   = useState('')

  // Existing-client search (prefills the form when one is picked)
  const [clientQuery, setClientQuery]     = useState('')
  const [clientResults, setClientResults] = useState<ClientHit[]>([])
  const [searching, setSearching]         = useState(false)

  const loadServices = useCallback(async () => {
    const res = await fetch('/api/services')
    const j   = await res.json()
    if (j.success) setServices(j.data)
  }, [])

  useEffect(() => {
    if (open) {
      loadServices()
      setFieldErrors({}); setApiError(''); setSuccess('')
      setClientQuery(''); setClientResults([])
    }
  }, [open, loadServices])

  // Debounced search of existing clients via /api/clients?search=
  useEffect(() => {
    const q = clientQuery.trim()
    if (q.length < 2) { setClientResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=6`)
        const j   = await res.json()
        if (j.success) setClientResults(j.data.clients ?? [])
      } catch { /* ignore network errors in the picker */ }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [clientQuery])

  function pickClient(c: ClientHit) {
    setForm(f => ({ ...f, clientName: c.name, clientEmail: c.email, clientPhone: c.phone ?? '' }))
    setClientQuery(''); setClientResults([])
    setFieldErrors(fe => ({ ...fe, clientName: undefined, clientEmail: undefined, clientPhone: undefined }))
  }

  function field(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }))
      // Limpiar error del campo al editar
      if (fieldErrors[key]) setFieldErrors(fe => ({ ...fe, [key]: undefined }))
    }
  }

  function validate(): boolean {
    const errs: FieldErrors = {}
    if (!form.clientName.trim()) errs.clientName  = 'El nombre es requerido'
    if (!form.clientEmail.trim()) errs.clientEmail = 'El email es requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail))
      errs.clientEmail = 'Email inválido'
    if (!form.clientPhone.trim()) errs.clientPhone = 'El teléfono es requerido'
    if (!form.serviceId)          errs.serviceId   = 'Selecciona un servicio'
    if (!form.date)               errs.date        = 'La fecha es requerida'
    if (!form.startTime)          errs.startTime   = 'La hora es requerida'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true); setApiError(''); setSuccess('')

    const res = await fetch('/api/appointments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const j = await res.json()
    setSaving(false)

    if (!j.success) { setApiError(j.error ?? 'Error al crear la cita'); return }

    setSuccess('Cita creada correctamente ✓')
    setForm(EMPTY)
    setTimeout(() => { setOpen(false); setSuccess(''); router.refresh() }, 1200)
  }

  const Err = ({ k }: { k: keyof typeof EMPTY }) =>
    fieldErrors[k] ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[k]}</p> : null

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        + Cita manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink">Nueva cita manual</h2>
              <button onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
            </div>

            <form onSubmit={submit} noValidate className="px-6 py-5 space-y-5">

              {/* Datos del cliente */}
              <fieldset>
                <p className="text-xs font-medium text-ink-mid uppercase tracking-wider mb-3">
                  Datos del cliente
                </p>

                {/* Existing-client search — pick one to prefill, or just type a new one */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    placeholder="Buscar cliente existente por nombre, email o teléfono…"
                    aria-label="Buscar cliente existente"
                    className="input-field w-full pr-9"
                    autoComplete="off"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">
                    {searching ? '…' : '⌕'}
                  </span>
                  {clientResults.length > 0 && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-beige-dark
                                   rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {clientResults.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => pickClient(c)}
                            className="w-full text-left px-4 py-2.5 hover:bg-gold-pale transition-colors">
                            <span className="block text-sm text-ink font-medium">{c.name}</span>
                            <span className="block text-xs text-ink-muted">
                              {c.email}{c.phone ? ` · ${c.phone}` : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {clientQuery.trim().length >= 2 && !searching && clientResults.length === 0 && (
                    <p className="text-xs text-ink-muted mt-1.5 px-1">
                      Sin coincidencias — completa los datos para crear un cliente nuevo.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-ink-mid mb-1">
                      Nombre completo <span className="text-red-500">*</span>
                    </label>
                    <input value={form.clientName} onChange={field('clientName')}
                      placeholder="Ana García"
                      className={`input-field w-full ${fieldErrors.clientName ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientName" />
                  </div>
                  <div>
                    <label className="block text-sm text-ink-mid mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input type="email" value={form.clientEmail} onChange={field('clientEmail')}
                      placeholder="ana@ejemplo.com"
                      className={`input-field w-full ${fieldErrors.clientEmail ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientEmail" />
                  </div>
                  <div>
                    <label className="block text-sm text-ink-mid mb-1">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input value={form.clientPhone} onChange={field('clientPhone')}
                      placeholder="3001234567"
                      className={`input-field w-full ${fieldErrors.clientPhone ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientPhone" />
                  </div>
                </div>
              </fieldset>

              {/* Servicio + fecha + hora */}
              <fieldset>
                <p className="text-xs font-medium text-ink-mid uppercase tracking-wider mb-3">
                  Cita
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-ink-mid mb-1">
                      Servicio <span className="text-red-500">*</span>
                    </label>
                    <select value={form.serviceId} onChange={field('serviceId')}
                      className={`input-field w-full bg-white ${fieldErrors.serviceId ? 'border-red-400' : ''}`}>
                      <option value="">— Selecciona un servicio —</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.durationMinutes} min
                        </option>
                      ))}
                    </select>
                    <Err k="serviceId" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-ink-mid mb-1">
                        Fecha <span className="text-red-500">*</span>
                      </label>
                      <input type="date" value={form.date} onChange={field('date')}
                        aria-label="Fecha"
                        min={minManualDate()}
                        className={`input-field w-full ${fieldErrors.date ? 'border-red-400' : ''}`} />
                      <p className="text-[11px] text-ink-muted mt-1">Hasta {PAST_LIMIT_DAYS} días atrás</p>
                      <Err k="date" />
                    </div>
                    <div>
                      <label className="block text-sm text-ink-mid mb-1">
                        Hora <span className="text-red-500">*</span>
                      </label>
                      <input type="time" value={form.startTime}
                        aria-label="Hora"
                        onChange={e => {
                          setForm(f => ({ ...f, startTime: e.target.value.slice(0, 5) }))
                          if (fieldErrors.startTime) setFieldErrors(fe => ({ ...fe, startTime: undefined }))
                        }}
                        className={`input-field w-full ${fieldErrors.startTime ? 'border-red-400' : ''}`} />
                      <Err k="startTime" />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Origen */}
              <fieldset>
                <p className="text-xs font-medium text-ink-mid uppercase tracking-wider mb-2">
                  Origen de la cita
                </p>
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
              </fieldset>

              {/* Notas */}
              <div>
                <label className="block text-sm text-ink-mid mb-1">Notas internas</label>
                <textarea value={form.notes} onChange={field('notes')}
                  placeholder="Preferencias, alergias, observaciones..."
                  rows={2} className="input-field w-full resize-none" />
              </div>

              {/* Forzar horario */}
              <label className="flex items-start gap-2 text-sm text-ink-muted cursor-pointer">
                <input type="checkbox" checked={form.skipAvailabilityCheck}
                  onChange={e => setForm(f => ({ ...f, skipAvailabilityCheck: e.target.checked }))}
                  className="mt-0.5 rounded border-beige-dark text-gold focus:ring-gold/40" />
                <span>Forzar aunque el horario esté ocupado</span>
              </label>

              {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
                  {apiError}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">
                  {success}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="btn-secondary flex-1">
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
