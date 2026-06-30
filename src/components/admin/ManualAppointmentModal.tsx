'use client'
// src/components/admin/ManualAppointmentModal.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice, isValidPhone } from '@/lib/utils'
import { computeDiscountAmount } from '@/lib/discount'
import ClientSearchInput, { type ClientHit } from './ClientSearchInput'
import AdicionalesEditor, { type Adicional } from './AdicionalesEditor'

interface Service { id: string; name: string; price: number; durationMinutes: number }

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
  // Premarcado según el origen: un cliente presencial ya sabe que su cita
  // quedó agendada; los demás orígenes se benefician de recibirlo por mail.
  notifyClient: false,
  mode: 'UPCOMING' as 'UPCOMING' | 'PAST',
  totalCharged: '',
  // Manual discount (optional): empty descuentoValor = no discount.
  descuentoTipo: 'PORCENTAJE' as 'PORCENTAJE' | 'VALOR_FIJO',
  descuentoValor: '', descuentoMotivo: '',
}

type FieldErrors = Partial<Record<keyof typeof EMPTY, string>>
type Touched = Partial<Record<keyof typeof EMPTY, boolean>>

// Fields validated on blur/submit (in display order).
const VALIDATED_FIELDS: (keyof typeof EMPTY)[] = [
  'clientName', 'clientEmail', 'clientPhone', 'serviceId', 'date', 'startTime',
  'totalCharged', 'descuentoValor',
]

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
  const [extras, setExtras]     = useState<Adicional[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [touched, setTouched]   = useState<Touched>({})
  const [saving, setSaving]     = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess]   = useState('')

  const emailInputRef = useRef<HTMLInputElement>(null)

  const loadServices = useCallback(async () => {
    const res = await fetch('/api/services')
    const j   = await res.json()
    if (j.success) setServices(j.data)
  }, [])

  useEffect(() => {
    if (open) {
      loadServices()
      setFieldErrors({}); setTouched({}); setApiError(''); setSuccess('')
    } else {
      setExtras([])
    }
  }, [open, loadServices])

  function pickClient(c: ClientHit) {
    setForm(f => ({ ...f, clientName: c.name, clientEmail: c.email ?? '', clientPhone: c.phone ?? '' }))
    setFieldErrors(fe => ({ ...fe, clientName: undefined, clientEmail: undefined, clientPhone: undefined }))
  }

  // "Crear cliente nuevo" — no existing match, so just hand the typed text
  // to the regular fields and let the admin keep filling them. The actual
  // Client record gets created (upserted by email) when the appointment is saved.
  function startNewClient(query: string) {
    setForm(f => ({ ...f, clientName: query }))
    if (fieldErrors.clientName) setFieldErrors(fe => ({ ...fe, clientName: undefined }))
    emailInputRef.current?.focus()
  }

  function field(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }))
      // Clear the field error on edit
      if (fieldErrors[key]) setFieldErrors(fe => ({ ...fe, [key]: undefined }))
    }
  }

  // Validates a single field against the current form/extras state. Same
  // rules as before — only the call sites (blur/submit, not onChange) changed.
  function validateField(key: keyof typeof EMPTY): string | undefined {
    switch (key) {
      case 'clientName':
        return form.clientName.trim() ? undefined : 'El nombre es requerido'
      case 'clientEmail':
        // Email is optional — only validate the format if something was typed.
        return form.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim())
          ? 'Email inválido' : undefined
      case 'clientPhone':
        if (!form.clientPhone.trim()) return 'El teléfono es requerido'
        if (!isValidPhone(form.clientPhone)) return 'El teléfono debe tener al menos 10 dígitos'
        return undefined
      case 'serviceId':
        return form.serviceId ? undefined : 'Selecciona un servicio'
      case 'date':
        if (!form.date) return 'La fecha es requerida'
        if (form.mode === 'PAST' && form.date >= offsetDate(0)) return 'Debe ser una fecha anterior a hoy'
        return undefined
      case 'startTime':
        return form.startTime ? undefined : 'La hora es requerida'
      case 'totalCharged':
        if (form.mode !== 'PAST') return undefined
        return form.totalCharged === '' || Number(form.totalCharged) < 0
          ? 'El total cobrado es requerido' : undefined
      case 'descuentoValor': {
        if (form.mode !== 'PAST') return undefined
        const sub = (Number(form.totalCharged) || 0) + extras.reduce((s, e) => s + (Number(e.amount) || 0), 0)
        const dv  = Number(form.descuentoValor) || 0
        if (dv > 0 && form.descuentoTipo === 'PORCENTAJE' && dv > 100) return 'El porcentaje no puede superar 100'
        if (dv > 0 && form.descuentoTipo === 'VALOR_FIJO' && dv > sub) return 'El descuento no puede superar el subtotal'
        return undefined
      }
      default:
        return undefined
    }
  }

  // Runs on submit: validates every field, marks them all as touched (so
  // never-blurred fields show their error too), and shows all errors at once.
  function validate(): boolean {
    const errs: FieldErrors = {}
    VALIDATED_FIELDS.forEach((k) => {
      const err = validateField(k)
      if (err) errs[k] = err
    })
    setFieldErrors(errs)
    setTouched((t) => ({ ...t, ...Object.fromEntries(VALIDATED_FIELDS.map((k) => [k, true])) }))
    return Object.keys(errs).length === 0
  }

  // onBlur handler: marks the field touched and validates just that field,
  // independent of whether other fields have been visited yet.
  function handleBlur(key: keyof typeof EMPTY) {
    return () => {
      setTouched((t) => ({ ...t, [key]: true }))
      setFieldErrors((fe) => ({ ...fe, [key]: validateField(key) }))
    }
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
      ...(!isPast ? { notifyClient: form.notifyClient } : {}),
      ...(isPast ? {
        totalCharged: Number(form.totalCharged),
        extras: extras
          .filter((e) => e.description.trim() && Number(e.amount) > 0)
          .map((e) => ({ description: e.description.trim(), amount: Number(e.amount) })),
        ...(Number(form.descuentoValor) > 0 ? {
          descuentoTipo:   form.descuentoTipo,
          descuentoValor:  Number(form.descuentoValor),
          descuentoMotivo: form.descuentoMotivo.trim() || undefined,
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
    setExtras([])
    setTimeout(() => {
      setOpen(false); setSuccess('')
      // A past appointment is dated before today, so the default "Próximas"
      // window would hide it. Send the admin to the "Pasadas" scope, which
      // lists past appointments most-recent-first (see lib/appointmentList.ts).
      if (isPast) router.push('/admin/citas?scope=past')
      else router.refresh()
    }, 1200)
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

  const extraAmountNum  = extras.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const totalChargedNum = Number(form.totalCharged) || 0
  const subtotal        = totalChargedNum + extraAmountNum
  const descuentoNum    = Number(form.descuentoValor) || 0
  const hasDiscount     = descuentoNum > 0
  const discountAmount  = computeDiscountAmount(subtotal, form.descuentoTipo, descuentoNum)
  const grandTotal      = subtotal - discountAmount
  // Fixed discount bigger than the subtotal is invalid (percentage is capped at 100).
  const discountTooBig  = hasDiscount && form.descuentoTipo === 'VALOR_FIJO' && descuentoNum > subtotal

  const Err = ({ k }: { k: keyof typeof EMPTY }) =>
    touched[k] && fieldErrors[k] ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[k]}</p> : null

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

                {/* Existing-client search — pick one to prefill, or create a new one */}
                <ClientSearchInput
                  className="mb-3"
                  onSelect={pickClient}
                  onCreateNew={startNewClient}
                />

                <div className="space-y-3">
                  <div>
                    <label className="form-label">
                      Nombre completo <span className="text-red-500">*</span>
                    </label>
                    <input value={form.clientName} onChange={field('clientName')} onBlur={handleBlur('clientName')}
                      placeholder="Ana García"
                      className={`input-field w-full ${touched.clientName && fieldErrors.clientName ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientName" />
                  </div>
                  <div>
                    <label className="form-label">
                      Email <span className="text-ink-muted/60 normal-case font-normal tracking-normal">(opcional)</span>
                    </label>
                    <input ref={emailInputRef} type="email" value={form.clientEmail} onChange={field('clientEmail')} onBlur={handleBlur('clientEmail')}
                      placeholder="ana@ejemplo.com"
                      className={`input-field w-full ${touched.clientEmail && fieldErrors.clientEmail ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientEmail" />
                    {!form.clientEmail.trim() && (
                      <p className="text-[11px] text-ink-muted/70 mt-0.5">Sin email no se enviarán notificaciones al cliente.</p>
                    )}
                  </div>
                  <div>
                    <label className="form-label">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input value={form.clientPhone} onChange={field('clientPhone')} onBlur={handleBlur('clientPhone')}
                      placeholder="3001234567"
                      className={`input-field w-full ${touched.clientPhone && fieldErrors.clientPhone ? 'border-red-400 focus:ring-red-300' : ''}`} />
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
                    <select value={form.serviceId} onChange={e => selectService(e.target.value)} onBlur={handleBlur('serviceId')}
                      className={`input-field w-full bg-white ${touched.serviceId && fieldErrors.serviceId ? 'border-red-400' : ''}`}>
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
                      <input type="date" value={form.date} onChange={field('date')} onBlur={handleBlur('date')}
                        aria-label="Fecha"
                        min={minManualDate()}
                        max={form.mode === 'PAST' ? yesterday() : undefined}
                        className={`input-field w-full ${touched.date && fieldErrors.date ? 'border-red-400' : ''}`} />
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
                        onBlur={handleBlur('startTime')}
                        className={`input-field w-full ${touched.startTime && fieldErrors.startTime ? 'border-red-400' : ''}`} />
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
                        onChange={field('totalCharged')} onBlur={handleBlur('totalCharged')}
                        className={`input-field w-full ${touched.totalCharged && fieldErrors.totalCharged ? 'border-red-400' : ''}`} />
                      <Err k="totalCharged" />
                    </div>
                    <div>
                      <label className="form-label">Adicional (opcional)</label>
                      <AdicionalesEditor items={extras} onChange={setExtras} />
                    </div>
                    {/* Discount (optional) */}
                    <div>
                      <label className="form-label">Descuento (opcional)</label>
                      <div className="flex gap-2">
                        <div className="flex rounded-lg border border-beige-dark overflow-hidden shrink-0">
                          {(['PORCENTAJE', 'VALOR_FIJO'] as const).map((t) => (
                            <button key={t} type="button"
                              onClick={() => setForm(f => ({ ...f, descuentoTipo: t }))}
                              className={`px-3 py-2 text-sm transition-colors ${
                                form.descuentoTipo === t ? 'bg-gold text-white' : 'bg-white text-ink-muted hover:text-ink'
                              }`}>
                              {t === 'PORCENTAJE' ? '%' : '$'}
                            </button>
                          ))}
                        </div>
                        <input type="number" min={0} step={form.descuentoTipo === 'PORCENTAJE' ? 1 : 1000}
                          max={form.descuentoTipo === 'PORCENTAJE' ? 100 : undefined}
                          value={form.descuentoValor} onChange={field('descuentoValor')} onBlur={handleBlur('descuentoValor')}
                          placeholder={form.descuentoTipo === 'PORCENTAJE' ? '0–100' : '0'}
                          className={`input-field w-[120px] ${touched.descuentoValor && discountTooBig ? 'border-red-400' : ''}`} />
                      </div>
                      {touched.descuentoValor && discountTooBig && (
                        <p className="text-xs text-red-500 mt-0.5">El descuento no puede superar el subtotal.</p>
                      )}
                      <input value={form.descuentoMotivo} onChange={field('descuentoMotivo')}
                        placeholder="Motivo del descuento (interno, opcional)…"
                        className="input-field w-full mt-2" />
                    </div>

                    <div className="bg-beige-pale rounded-lg px-4 py-3 text-sm space-y-1">
                      <div className="flex justify-between text-ink-muted">
                        <span>Servicio</span><span>{formatPrice(totalChargedNum)}</span>
                      </div>
                      {extras
                        .filter((e) => e.description.trim() && Number(e.amount) > 0)
                        .map((e, i) => (
                          <div key={i} className="flex justify-between text-ink-muted">
                            <span>Adicional ({e.description.trim()})</span>
                            <span>{formatPrice(Number(e.amount))}</span>
                          </div>
                        ))}
                      {hasDiscount && !discountTooBig && (
                        <>
                          <div className="flex justify-between text-ink-muted border-t border-beige-dark pt-1 mt-1">
                            <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-gold-dark">
                            <span>Descuento{form.descuentoTipo === 'PORCENTAJE' ? ` (${descuentoNum}%)` : ''}</span>
                            <span>−{formatPrice(discountAmount)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-ink font-medium border-t border-beige-dark pt-1 mt-1">
                        <span>Total a cobrar</span><span>{formatPrice(grandTotal)}</span>
                      </div>
                      {hasDiscount && !discountTooBig && grandTotal === 0 && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                          ⚠️ El total será $0. Se registrará como cortesía.
                        </p>
                      )}
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
                      onClick={() => setForm(f => ({
                        ...f, source: opt.value,
                        notifyClient: opt.value !== 'PRESENCIAL',
                      }))}
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

              {/* Notificar al cliente (no aplica a citas pasadas ni sin email) */}
              {form.mode === 'UPCOMING' && (
                <label className={`flex items-start gap-2 text-sm text-ink-muted ${form.clientEmail.trim() ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                  <input type="checkbox"
                    checked={form.notifyClient && !!form.clientEmail.trim()}
                    disabled={!form.clientEmail.trim()}
                    onChange={e => setForm(f => ({ ...f, notifyClient: e.target.checked }))}
                    className="mt-0.5 rounded border-beige-dark text-gold focus:ring-gold/40" />
                  <span>Notificar al cliente por email{!form.clientEmail.trim() && ' (requiere email)'}</span>
                </label>
              )}

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
