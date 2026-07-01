'use client'
// src/components/admin/ManualAppointmentModal.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice, isValidPhone } from '@/lib/utils'
import { computeDiscountAmount } from '@/lib/discount'
import ClientSearchInput, { type ClientHit } from './ClientSearchInput'
import AdicionalesEditor, { type Adicional } from './AdicionalesEditor'
import DescuentoEditor from './DescuentoEditor'

interface Service { id: string; name: string; price: number; durationMinutes: number; category?: { id: string; name: string; order: number } | null }

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
  serviceIds: [] as string[], date: '', startTime: '',
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
  'clientName', 'clientEmail', 'clientPhone', 'serviceIds', 'date', 'startTime',
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
  const [descuentoOpen, setDescuentoOpen] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [serviceQuery, setServiceQuery] = useState('')
  // Id of the existing client picked from the search (null = new/typed client).
  const [pickedClientId, setPickedClientId] = useState<string | null>(null)
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
      setExtras([]); setDescuentoOpen(false); setExtrasOpen(false); setServiceQuery(''); setPickedClientId(null)
    }
  }, [open, loadServices])

  function pickClient(c: ClientHit) {
    setForm(f => ({ ...f, clientName: c.name, clientEmail: c.email ?? '', clientPhone: c.phone ?? '' }))
    setPickedClientId(c.id)
    setFieldErrors(fe => ({ ...fe, clientName: undefined, clientEmail: undefined, clientPhone: undefined }))
  }

  // "Crear cliente nuevo" — no existing match, so just hand the typed text
  // to the regular fields and let the admin keep filling them. The actual
  // Client record gets created (upserted by email) when the appointment is saved.
  function startNewClient(query: string) {
    setForm(f => ({ ...f, clientName: query }))
    setPickedClientId(null)
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
      case 'serviceIds':
        return form.serviceIds.length ? undefined : 'Selecciona al menos un servicio'
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
      ...(pickedClientId ? { clientId: pickedClientId } : {}),
      serviceId: form.serviceIds[0], serviceIds: form.serviceIds, date: form.date, startTime: form.startTime,
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
    setDescuentoOpen(false)
    setExtrasOpen(false)
    setServiceQuery('')
    setPickedClientId(null)
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
      if (mode === 'PAST' && f.serviceIds.length) {
        const sum = f.serviceIds.reduce((t, id) => t + (services.find(s => s.id === id)?.price ?? 0), 0)
        return { ...f, mode, totalCharged: sum ? String(sum) : f.totalCharged }
      }
      return { ...f, mode }
    })
  }

  // Toggle a service in/out of the selection. In "Cita pasada" the "Total
  // cobrado" auto-syncs to the sum of the selected services' catalog prices.
  function toggleService(id: string) {
    setForm(f => {
      const serviceIds = f.serviceIds.includes(id)
        ? f.serviceIds.filter(x => x !== id)
        : [...f.serviceIds, id]
      const sum = serviceIds.reduce((t, sid) => t + (services.find(s => s.id === sid)?.price ?? 0), 0)
      return { ...f, serviceIds, totalCharged: f.mode === 'PAST' ? String(sum) : f.totalCharged }
    })
    if (fieldErrors.serviceIds) setFieldErrors(fe => ({ ...fe, serviceIds: undefined }))
  }

  // "+ Agregar adicional" seeds one empty row; "Ocultar" drops the empty rows.
  function showExtras() {
    setExtras((e) => (e.length > 0 ? e : [{ description: '', amount: '' }]))
    setExtrasOpen(true)
  }
  function hideExtras() {
    setExtras((e) => e.filter((it) => it.description.trim() || it.amount.trim()))
    setExtrasOpen(false)
  }

  // Multi-service picker: selected chips + a searchable, category-grouped list.
  const selectedServices = form.serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s))
  const svcQuery = serviceQuery.trim().toLowerCase()
  const filteredServices = svcQuery
    ? services.filter((s) => s.name.toLowerCase().includes(svcQuery))
    : services
  const groupedServices = Array.from(
    filteredServices.reduce((map, s) => {
      const key = s.category?.id ?? '—'
      const g = map.get(key) ?? { name: s.category?.name ?? 'Otros', order: s.category?.order ?? 999, items: [] as Service[] }
      g.items.push(s)
      map.set(key, g)
      return map
    }, new Map<string, { name: string; order: number; items: Service[] }>()).values(),
  ).sort((a, b) => a.order - b.order)

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
                    {/* Selected services as removable chips */}
                    {selectedServices.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedServices.map(s => (
                          <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                            className="inline-flex items-center gap-1 text-xs bg-gold-pale text-ink border border-gold/30 rounded-full px-2.5 py-1 hover:bg-gold/20 transition-colors">
                            {s.name} <span className="text-ink-muted">×</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <input type="search" value={serviceQuery} onChange={e => setServiceQuery(e.target.value)}
                      placeholder="🔍 Buscar servicio…" aria-label="Buscar servicio"
                      className="input-field w-full mb-2" />

                    {/* Category-grouped, searchable list */}
                    <div className={`space-y-2 max-h-56 overflow-y-auto rounded-lg border p-2 ${touched.serviceIds && fieldErrors.serviceIds ? 'border-red-400' : 'border-beige-dark'}`}>
                      {groupedServices.length === 0 ? (
                        <p className="text-xs text-ink-muted text-center py-3">Sin resultados</p>
                      ) : groupedServices.map(g => (
                        <div key={g.name}>
                          <p className="text-[10px] uppercase tracking-wider text-ink-muted/70 px-2 pt-1 pb-0.5">{g.name}</p>
                          {g.items.map(s => (
                            <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-beige cursor-pointer text-sm">
                              <input type="checkbox" checked={form.serviceIds.includes(s.id)}
                                onChange={() => toggleService(s.id)} className="accent-gold w-4 h-4 shrink-0" />
                              <span className="flex-1 text-ink">{s.name}</span>
                              <span className="text-xs text-ink-muted whitespace-nowrap">{s.durationMinutes} min · {formatPrice(s.price)}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                    {form.serviceIds.length > 1 && (
                      <p className="text-[11px] text-ink-muted mt-1">
                        {form.serviceIds.length} servicios · {form.serviceIds.reduce((t, id) => t + (services.find(s => s.id === id)?.durationMinutes ?? 0), 0)} min en total
                      </p>
                    )}
                    <Err k="serviceIds" />
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
                    <AdicionalesEditor items={extras} onChange={setExtras}
                      open={extrasOpen} onAdd={showExtras} onRemove={hideExtras} />
                    {/* Discount (optional) — shared collapsible editor */}
                    <DescuentoEditor
                      open={descuentoOpen}
                      tipo={form.descuentoTipo}
                      valor={form.descuentoValor}
                      motivo={form.descuentoMotivo}
                      error={descuentoOpen && discountTooBig ? 'El descuento no puede superar el subtotal.' : null}
                      onAdd={() => setDescuentoOpen(true)}
                      onRemove={() => {
                        setDescuentoOpen(false)
                        setForm(f => ({ ...f, descuentoValor: '', descuentoMotivo: '' }))
                        setFieldErrors(fe => ({ ...fe, descuentoValor: undefined }))
                      }}
                      onChange={(patch) => {
                        setForm(f => ({
                          ...f,
                          ...(patch.tipo   !== undefined ? { descuentoTipo:   patch.tipo }   : {}),
                          ...(patch.valor  !== undefined ? { descuentoValor:  patch.valor }  : {}),
                          ...(patch.motivo !== undefined ? { descuentoMotivo: patch.motivo } : {}),
                        }))
                        if (patch.valor !== undefined && fieldErrors.descuentoValor) {
                          setFieldErrors(fe => ({ ...fe, descuentoValor: undefined }))
                        }
                      }}
                    />

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
