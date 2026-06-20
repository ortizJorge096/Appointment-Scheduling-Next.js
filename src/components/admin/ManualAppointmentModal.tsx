'use client'
// src/components/admin/ManualAppointmentModal.tsx

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'

interface Service { id: string; name: string; price: number; durationMinutes: number }
interface ClientHit { id: string; name: string; email: string; phone: string | null }

const SOURCE_OPTIONS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'WHATSAPP',   label: 'WhatsApp'   },
  { value: 'TELEFONO',   label: 'Teléfono'   },
  { value: 'ONLINE',     label: 'Online'     },
]

const MODE_OPTIONS = [
  { value: 'UPCOMING', label: 'Cita próxima' },
  { value: 'PAST',     label: 'Cita pasada'  },
] as const

const EMPTY = {
  clientName: '', clientEmail: '', clientPhone: '',
  serviceId: '', date: '', startTime: '',
  source: 'PRESENCIAL', notes: '',
  skipAvailabilityCheck: false,
  mode: 'UPCOMING' as 'UPCOMING' | 'PAST',
  totalCharged: '', extraDescription: '', extraAmount: '',
}

type FieldErrors = Partial<Record<keyof typeof EMPTY, string>>

// Earliest date allowed for manual backfill: 15 days ago
const PAST_LIMIT_DAYS = 15
function offsetDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function minManualDate() { return offsetDate(-PAST_LIMIT_DAYS) }
function yesterday()     { return offsetDate(-1) }

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
      // Clear the field error on edit
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
    if (form.mode === 'PAST') {
      if (form.date >= offsetDate(0)) errs.date = 'Debe ser una fecha anterior a hoy'
      if (form.totalCharged === '' || Number(form.totalCharged) < 0)
        errs.totalCharged = 'El total cobrado es requerido'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true); setApiError(''); setSuccess('')

    const isPast = form.mode === 'PAST'
    const payload = {
      clientName: form.clientName, clientEmail: form.clientEmail, clientPhone: form.clientPhone,
      serviceId: form.serviceId, date: form.date, startTime: form.startTime,
      source: form.source, notes: form.notes,
      skipAvailabilityCheck: form.skipAvailabilityCheck,
      mode: form.mode,
      ...(isPast ? {
        totalCharged: Number(form.totalCharged),
        ...(form.extraAmount !== '' ? {
          extraDescription: form.extraDescription.trim() || undefined,
          extraAmount: Number(form.extraAmount),
        } : {}),
      } : {}),
    }

    const res = await fetch('/api/appointments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json()
    setSaving(false)

    if (!j.success) { setApiError(j.error ?? 'Error al crear la cita'); return }

    setSuccess(isPast ? 'Cita registrada correctamente ✓' : 'Cita creada correctamente ✓')
    setForm(EMPTY)
    setTimeout(() => { setOpen(false); setSuccess(''); router.refresh() }, 1200)
  }

  // Keep "Total cobrado" in sync with the selected service's default price
  // while in "Cita pasada" mode (admin can still edit it afterwards).
  function selectMode(mode: 'UPCOMING' | 'PAST') {
    setForm(f => {
      if (mode === 'PAST' && f.serviceId) {
        const svc = services.find(s => s.id === f.serviceId)
        return { ...f, mode, totalCharged: svc ? String(svc.price) : f.totalCharged }
      }
      return { ...f, mode }
    })
  }

  function selectService(serviceId: string) {
    setForm(f => {
      const svc = services.find(s => s.id === serviceId)
      return {
        ...f, serviceId,
        totalCharged: f.mode === 'PAST' && svc ? String(svc.price) : f.totalCharged,
      }
    })
    if (fieldErrors.serviceId) setFieldErrors(fe => ({ ...fe, serviceId: undefined }))
  }

  const extraAmountNum = Number(form.extraAmount) || 0
  const totalChargedNum = Number(form.totalCharged) || 0
  const grandTotal = totalChargedNum + extraAmountNum

  const Err = ({ k }: { k: keyof typeof EMPTY }) =>
    fieldErrors[k] ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[k]}</p> : null

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        + Cita manual
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink">Nueva cita manual</h2>
              <button onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-ink text-xl leading-none">×</button>
            </div>

            <form onSubmit={submit} noValidate className="px-6 py-5 space-y-5">

              {/* Modo de creación */}
              <fieldset>
                <div className="flex gap-2">
                  {MODE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => selectMode(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                        form.mode === opt.value
                          ? 'bg-gold text-white border-gold'
                          : 'border-beige-dark text-ink-muted hover:border-gold/50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.mode === 'PAST' && (
                  <p className="text-xs text-ink bg-gold-pale border border-gold/30 rounded-lg px-3 py-2 mt-2">
                    Esta cita se marcará como completada y pagada al guardar
                  </p>
                )}
              </fieldset>

              {/* Datos del cliente */}
              <fieldset>
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
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
                    <label className="form-label">
                      Nombre completo <span className="text-red-500">*</span>
                    </label>
                    <input value={form.clientName} onChange={field('clientName')}
                      placeholder="Ana García"
                      className={`input-field w-full ${fieldErrors.clientName ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientName" />
                  </div>
                  <div>
                    <label className="form-label">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input type="email" value={form.clientEmail} onChange={field('clientEmail')}
                      placeholder="ana@ejemplo.com"
                      className={`input-field w-full ${fieldErrors.clientEmail ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientEmail" />
                  </div>
                  <div>
                    <label className="form-label">
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
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
                  Cita
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="form-label">
                      Servicio <span className="text-red-500">*</span>
                    </label>
                    <select value={form.serviceId} onChange={e => selectService(e.target.value)}
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
                      <label className="form-label">
                        Fecha <span className="text-red-500">*</span>
                      </label>
                      <input type="date" value={form.date} onChange={field('date')}
                        aria-label="Fecha"
                        min={minManualDate()}
                        max={form.mode === 'PAST' ? yesterday() : undefined}
                        className={`input-field w-full ${fieldErrors.date ? 'border-red-400' : ''}`} />
                      <p className="text-[11px] text-ink-muted mt-1">
                        {form.mode === 'PAST'
                          ? `Hasta ${PAST_LIMIT_DAYS} días atrás, antes de hoy`
                          : `Hasta ${PAST_LIMIT_DAYS} días atrás`}
                      </p>
                      <Err k="date" />
                    </div>
                    <div>
                      <label className="form-label">
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

              {/* Precio (solo cita pasada) */}
              {form.mode === 'PAST' && (
                <fieldset>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-3">
                    Precio
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">
                        Total cobrado (COP) <span className="text-red-500">*</span>
                      </label>
                      <input type="number" min={0} step={1000} value={form.totalCharged}
                        onChange={field('totalCharged')}
                        className={`input-field w-full ${fieldErrors.totalCharged ? 'border-red-400' : ''}`} />
                      <Err k="totalCharged" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Adicional — descripción</label>
                        <input value={form.extraDescription} onChange={field('extraDescription')}
                          placeholder="Ej: Tinte extra"
                          className="input-field w-full" />
                      </div>
                      <div>
                        <label className="form-label">Adicional — monto (COP)</label>
                        <input type="number" min={0} step={1000} value={form.extraAmount}
                          onChange={field('extraAmount')}
                          placeholder="0"
                          className="input-field w-full" />
                      </div>
                    </div>
                    <div className="bg-beige-pale rounded-lg px-4 py-3 text-sm space-y-1">
                      <div className="flex justify-between text-ink-muted">
                        <span>Servicio</span><span>{formatPrice(totalChargedNum)}</span>
                      </div>
                      {extraAmountNum > 0 && (
                        <div className="flex justify-between text-ink-muted">
                          <span>Adicional{form.extraDescription.trim() ? ` (${form.extraDescription.trim()})` : ''}</span>
                          <span>{formatPrice(extraAmountNum)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-ink font-medium border-t border-beige-dark pt-1 mt-1">
                        <span>Total</span><span>{formatPrice(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </fieldset>
              )}

              {/* Origen */}
              <fieldset>
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2">
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
                <label className="form-label">Notas internas</label>
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
                  {saving ? 'Guardando…' : form.mode === 'PAST' ? 'Registrar cita pasada' : 'Crear cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
