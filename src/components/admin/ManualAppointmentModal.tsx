'use client'
// src/components/admin/ManualAppointmentModal.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatPrice, isValidPhone } from '@/lib/utils'
import { computeAppointmentTotal } from '@/lib/discount'
import ClientSearchInput, { type ClientHit } from './ClientSearchInput'
import AdicionalesEditor, { type Adicional } from './AdicionalesEditor'
import { useCan } from './usePermissionGuard'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'

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

// Per-service discount + extras (past charge). Kept separate from `form`,
// keyed by serviceId.
interface LineExtraInput { description: string; amount: string }
interface LineInput { descTipo: 'PORCENTAJE' | 'VALOR_FIJO'; descValor: string; descMotivo: string; extras: LineExtraInput[] }
const emptyLine = (): LineInput => ({ descTipo: 'PORCENTAJE', descValor: '', descMotivo: '', extras: [] })

const EMPTY = {
  clientName: '', clientEmail: '', clientPhone: '',
  serviceIds: [] as string[], date: '', startTime: '',
  source: 'PRESENCIAL', notes: '',
  skipAvailabilityCheck: false,
  // Pre-checked based on the source: a walk-in client already knows their
  // appointment is booked; other sources benefit from getting it by email.
  notifyClient: false,
  mode: 'UPCOMING' as 'UPCOMING' | 'PAST',
  // Order-level (total) discount (optional): empty descuentoValor = no discount.
  descuentoTipo: 'PORCENTAJE' as 'PORCENTAJE' | 'VALOR_FIJO',
  descuentoValor: '', descuentoMotivo: '',
}

type FieldErrors = Partial<Record<keyof typeof EMPTY, string>>
type Touched = Partial<Record<keyof typeof EMPTY, boolean>>

// Fields validated on blur/submit (in display order).
const VALIDATED_FIELDS: (keyof typeof EMPTY)[] = [
  'clientName', 'clientEmail', 'clientPhone', 'serviceIds', 'date', 'startTime',
]

// Earliest date allowed for manual backfill: 15 days ago
const PAST_LIMIT_DAYS = 15
function offsetDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function minManualDate() { return offsetDate(-PAST_LIMIT_DAYS) }
function today()         { return offsetDate(0) }
// Current wall-clock time HH:MM (browser local). The API re-validates in the
// studio timezone, so this is only a best-effort UI guard.
function nowHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ManualAppointmentModal() {
  const can = useCan()
  const formRef = useRef<HTMLFormElement>(null)
  const [payMethod, setPayMethod] = useState('')  // payment method for a "Cita pasada"
  const [open, setOpen]         = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [form, setForm]         = useState(EMPTY)
  const [extras, setExtras]     = useState<Adicional[]>([])
  const [extrasOpen, setExtrasOpen] = useState(false)
  // Per-service discount + extras, keyed by serviceId (past charge only).
  const [lines, setLines] = useState<Record<string, LineInput>>({})
  // Discount scope for a past charge: none | per service | order total (exclusive).
  const [discountScope, setDiscountScope] = useState<'none' | 'line' | 'order'>('none')
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
      setExtras([]); setExtrasOpen(false); setServiceQuery(''); setPickedClientId(null)
      setLines({}); setDiscountScope('none')
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
        if (form.mode === 'PAST') {
          if (form.date < minManualDate()) return `Solo hasta ${PAST_LIMIT_DAYS} días atrás`
          if (form.date > today())         return 'No puede ser una fecha futura'
        } else if (form.date < today()) {
          return 'La fecha debe ser hoy o futura'
        }
        return undefined
      case 'startTime':
        if (!form.startTime) return 'La hora es requerida'
        // A "past" appointment dated today must have a time earlier than now.
        if (form.mode === 'PAST' && form.date === today() && form.startTime >= nowHHMM())
          return 'La hora debe ser anterior a la hora actual'
        return undefined
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
    if (!validate()) {
      // The modal body scrolls, so an off-screen error would look like the
      // button did nothing — bring the first invalid field into view + focus it.
      setTimeout(() => {
        const el = formRef.current?.querySelector<HTMLElement>('.border-red-400')
        el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
        el?.focus?.()
      }, 50)
      return
    }
    if (form.mode === 'PAST' && orderDiscountTooBig) {
      setApiError('El descuento al total no puede superar el subtotal.')
      return
    }

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
        extras: extras
          .filter((e) => e.description.trim() && Number(e.amount) > 0)
          .map((e) => ({ description: e.description.trim(), amount: Number(e.amount) })),
        services: selectedServices.map((s) => {
          const l = lines[s.id]
          const lineDisc = discountScope === 'line' && !!l && Number(l.descValor) > 0
          const lineExtras = (l?.extras ?? [])
            .filter((e) => e.description.trim() && Number(e.amount) > 0)
            .map((e) => ({ description: e.description.trim(), amount: Number(e.amount) }))
          return {
            serviceId: s.id,
            ...(lineDisc ? {
              descuentoTipo:   l!.descTipo,
              descuentoValor:  Number(l!.descValor),
              descuentoMotivo: l!.descMotivo.trim() || undefined,
            } : {}),
            ...(lineExtras.length ? { extras: lineExtras } : {}),
          }
        }).filter((e) => 'descuentoTipo' in e || 'extras' in e),
        ...(discountScope === 'order' && Number(form.descuentoValor) > 0 ? {
          descuentoTipo:   form.descuentoTipo,
          descuentoValor:  Number(form.descuentoValor),
          descuentoMotivo: form.descuentoMotivo.trim() || undefined,
        } : {}),
        ...(payMethod ? { paymentMethod: payMethod } : {}),
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
    setPayMethod('')
    setExtras([])
    setExtrasOpen(false)
    setServiceQuery('')
    setPickedClientId(null)
    setLines({})
    setDiscountScope('none')
    setTimeout(() => {
      setOpen(false); setSuccess('')
      // A past appointment is dated before today, so the default "Próximas"
      // window would hide it. Send the admin to the "Pasadas" scope, which
      // lists past appointments most-recent-first (see lib/appointmentList.ts).
      // Notify the sibling list to refetch with its current filters so the new
      // appointment appears without a full reload; a past one also switches the
      // list to the "Pasadas" scope (dated before today, hidden by "Próximas").
      window.dispatchEvent(new CustomEvent('cita-creada', { detail: { scope: isPast ? 'past' : null } }))
    }, 1200)
  }

  // Switching modes resets date/time so a value valid in one mode can't linger
  // as invalid in the other (past window vs. today-onwards).
  function selectMode(mode: 'UPCOMING' | 'PAST') {
    setForm(f => ({ ...f, mode, date: '', startTime: '' }))
    setFieldErrors(fe => ({ ...fe, date: undefined, startTime: undefined }))
  }

  // Toggle a service in/out of the selection; drop its per-service line on removal.
  function toggleService(id: string) {
    const wasSelected = form.serviceIds.includes(id)
    setForm(f => ({
      ...f,
      serviceIds: wasSelected ? f.serviceIds.filter(x => x !== id) : [...f.serviceIds, id],
    }))
    if (wasSelected) setLines(prev => { const n = { ...prev }; delete n[id]; return n })
    if (fieldErrors.serviceIds) setFieldErrors(fe => ({ ...fe, serviceIds: undefined }))
  }

  // ── Per-service discount/extras helpers (past charge) ──
  function setLine(id: string, patch: Partial<LineInput>) {
    setLines(prev => ({ ...prev, [id]: { ...(prev[id] ?? emptyLine()), ...patch } }))
  }
  function addLineExtra(id: string) {
    setLines(prev => {
      const l = prev[id] ?? emptyLine()
      return { ...prev, [id]: { ...l, extras: [...l.extras, { description: '', amount: '' }] } }
    })
  }
  function setLineExtra(id: string, idx: number, patch: Partial<LineExtraInput>) {
    setLines(prev => {
      const l = prev[id] ?? emptyLine()
      return { ...prev, [id]: { ...l, extras: l.extras.map((e, i) => (i === idx ? { ...e, ...patch } : e)) } }
    })
  }
  function removeLineExtra(id: string, idx: number) {
    setLines(prev => {
      const l = prev[id] ?? emptyLine()
      return { ...prev, [id]: { ...l, extras: l.extras.filter((_, i) => i !== idx) } }
    })
  }
  // Discount scopes are exclusive: switching clears the other scope's values.
  function changeScope(scope: 'none' | 'line' | 'order') {
    setDiscountScope(scope)
    if (scope !== 'order') setForm(f => ({ ...f, descuentoValor: '', descuentoMotivo: '' }))
    if (scope !== 'line') setLines(prev => Object.fromEntries(
      Object.entries(prev).map(([k, l]) => [k, { ...l, descValor: '', descMotivo: '' }]),
    ))
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

  // Live money breakdown, mirroring the API (per-line OR order discount + extras).
  const calcLines = selectedServices.map((s) => {
    const l = lines[s.id]
    const lineDisc = discountScope === 'line' && !!l && Number(l.descValor) > 0
    return {
      price:          s.price,
      descuentoTipo:  lineDisc ? l!.descTipo : null,
      descuentoValor: lineDisc ? Number(l!.descValor) : null,
      extras:         (l?.extras ?? []).filter((e) => e.description.trim() && Number(e.amount) > 0).map((e) => Number(e.amount)),
    }
  })
  const generalExtraAmts = extras.filter((e) => e.description.trim() && Number(e.amount) > 0).map((e) => Number(e.amount))
  const orderDiscount = discountScope === 'order'
    ? { tipo: form.descuentoTipo, valor: Number(form.descuentoValor) || 0 }
    : undefined
  const breakdown = computeAppointmentTotal(calcLines, generalExtraAmts, orderDiscount)
  const orderBase = breakdown.servicesSubtotal + breakdown.extrasTotal
  const orderDiscountTooBig = discountScope === 'order' &&
    form.descuentoTipo === 'VALOR_FIJO' && (Number(form.descuentoValor) || 0) > orderBase

  const Err = ({ k }: { k: keyof typeof EMPTY }) =>
    touched[k] && fieldErrors[k] ? <p className="text-xs text-red-700 mt-0.5">{fieldErrors[k]}</p> : null

  // Roles without citas:crear (e.g. solo lectura) don't get the manual-booking entry point.
  if (!can('citas:crear')) return null

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        + Cita manual
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Nueva cita manual" maxWidth="max-w-lg">
            <form ref={formRef} onSubmit={submit} noValidate className="px-6 py-5 space-y-5">

              {/* Modo de creación */}
              <fieldset>
                <div className="flex gap-2">
                  {MODE_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => selectMode(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                        form.mode === opt.value
                          ? 'bg-gold text-ink border-gold'
                          : 'border-beige-dark text-ink-muted-deep hover:border-gold/50'
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
                {form.mode === 'PAST' && (
                  <div className="mt-3">
                    <label className="form-label text-[10px] !mb-1 block">Método de pago</label>
                    <div className="flex gap-2 flex-wrap">
                      {([['EFECTIVO', 'Efectivo'], ['NEQUI', 'Nequi'], ['TARJETA', 'Tarjeta'], ['TRANSFERENCIA', 'Transferencia']] as const).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setPayMethod(v)}
                          className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                            payMethod === v ? 'bg-gold text-ink border-gold' : 'border-beige-dark text-ink-muted-deep hover:border-gold/50'
                          }`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Datos del cliente */}
              <fieldset>
                <p className="text-xs font-medium text-ink-muted-deep uppercase tracking-wider mb-3">
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
                    <label htmlFor="ma-nombre" className="form-label">
                      Nombre completo <span className="text-red-700">*</span>
                    </label>
                    <input id="ma-nombre" value={form.clientName} onChange={field('clientName')} onBlur={handleBlur('clientName')}
                      placeholder="Ana García"
                      className={`input-field w-full ${touched.clientName && fieldErrors.clientName ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientName" />
                  </div>
                  <div>
                    <label htmlFor="ma-email" className="form-label">
                      Email <span className="text-ink-muted-deep normal-case font-normal tracking-normal">(opcional)</span>
                    </label>
                    <input id="ma-email" ref={emailInputRef} type="email" value={form.clientEmail} onChange={field('clientEmail')} onBlur={handleBlur('clientEmail')}
                      placeholder="ana@ejemplo.com"
                      className={`input-field w-full ${touched.clientEmail && fieldErrors.clientEmail ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientEmail" />
                    {!form.clientEmail.trim() && (
                      <p className="text-[11px] text-ink-muted-deep mt-0.5">Sin email no se enviarán notificaciones al cliente.</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="ma-telefono" className="form-label">
                      Teléfono <span className="text-red-700">*</span>
                    </label>
                    <input id="ma-telefono" value={form.clientPhone} onChange={field('clientPhone')} onBlur={handleBlur('clientPhone')}
                      placeholder="3001234567"
                      className={`input-field w-full ${touched.clientPhone && fieldErrors.clientPhone ? 'border-red-400 focus:ring-red-300' : ''}`} />
                    <Err k="clientPhone" />
                  </div>
                </div>
              </fieldset>

              {/* Servicio + fecha + hora */}
              <fieldset>
                <p className="text-xs font-medium text-ink-muted-deep uppercase tracking-wider mb-3">
                  Cita
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="form-label">
                      Servicio <span className="text-red-700">*</span>
                    </label>
                    {/* Selected services as removable chips */}
                    {selectedServices.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedServices.map(s => (
                          <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                            className="inline-flex items-center gap-1 text-xs bg-gold-pale text-ink border border-gold/30 rounded-full px-2.5 py-1 hover:bg-gold/20 transition-colors">
                            {s.name} <span className="text-ink-muted-deep">×</span>
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
                        <p className="text-xs text-ink-muted-deep text-center py-3">Sin resultados</p>
                      ) : groupedServices.map(g => (
                        <div key={g.name}>
                          <p className="text-[10px] uppercase tracking-wider text-ink-muted-deep px-2 pt-1 pb-0.5">{g.name}</p>
                          {g.items.map(s => (
                            <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-beige cursor-pointer text-sm">
                              <input type="checkbox" checked={form.serviceIds.includes(s.id)}
                                onChange={() => toggleService(s.id)} className="accent-gold w-4 h-4 shrink-0" />
                              <span className="flex-1 text-ink">{s.name}</span>
                              <span className="text-xs text-ink-muted-deep whitespace-nowrap">{s.durationMinutes} min · {formatPrice(s.price)}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                    {form.serviceIds.length > 1 && (
                      <p className="text-[11px] text-ink-muted-deep mt-1">
                        {form.serviceIds.length} servicios · {form.serviceIds.reduce((t, id) => t + (services.find(s => s.id === id)?.durationMinutes ?? 0), 0)} min en total
                      </p>
                    )}
                    <Err k="serviceIds" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">
                        Fecha <span className="text-red-700">*</span>
                      </label>
                      <input type="date" value={form.date} onChange={field('date')} onBlur={handleBlur('date')}
                        aria-label="Fecha"
                        min={form.mode === 'PAST' ? minManualDate() : today()}
                        max={form.mode === 'PAST' ? today() : undefined}
                        className={`input-field w-full ${touched.date && fieldErrors.date ? 'border-red-400' : ''}`} />
                      <p className="text-[11px] text-ink-muted-deep mt-1">
                        {form.mode === 'PAST'
                          ? `Hoy o hasta ${PAST_LIMIT_DAYS} días atrás`
                          : 'Desde hoy en adelante'}
                      </p>
                      <Err k="date" />
                    </div>
                    <div>
                      <label className="form-label">
                        Hora <span className="text-red-700">*</span>
                      </label>
                      <input type="time" value={form.startTime}
                        aria-label="Hora"
                        max={form.mode === 'PAST' && form.date === today() ? nowHHMM() : undefined}
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

              {/* Precio (solo cita pasada). El total se calcula solo. */}
              {form.mode === 'PAST' && (
                <fieldset>
                  <p className="text-xs font-medium text-ink-muted-deep uppercase tracking-wider mb-3">
                    Precio
                  </p>
                  <div className="space-y-4">

                    {/* Descuento: sin / por servicio / al total (excluyentes) */}
                    <div>
                      <span className="form-label !mb-1 block">Descuento</span>
                      <div className="flex gap-2">
                        {([['none', 'Sin descuento'], ['line', 'Por servicio'], ['order', 'Al total']] as const).map(([v, label]) => (
                          <button key={v} type="button" onClick={() => changeScope(v)}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs border transition-colors ${
                              discountScope === v ? 'bg-gold text-ink border-gold' : 'border-beige-dark text-ink-muted-deep hover:border-gold/50'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cada servicio: precio + descuento por línea (si aplica) + adicionales */}
                    <div className="space-y-2">
                      {selectedServices.length === 0 && (
                        <p className="text-xs text-ink-muted-deep">Selecciona al menos un servicio arriba.</p>
                      )}
                      {selectedServices.map((s) => {
                        const l = lines[s.id] ?? emptyLine()
                        return (
                          <div key={s.id} className="border border-beige-dark rounded-lg p-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-ink font-medium">{s.name}</span>
                              <span className="text-ink-muted-deep">{formatPrice(s.price)}</span>
                            </div>

                            {discountScope === 'line' && (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <div className="flex rounded-lg border border-beige-dark overflow-hidden shrink-0">
                                  {(['PORCENTAJE', 'VALOR_FIJO'] as const).map((t) => (
                                    <button key={t} type="button" onClick={() => setLine(s.id, { descTipo: t })}
                                      className={`px-2.5 py-1.5 text-xs ${l.descTipo === t ? 'bg-gold text-ink' : 'bg-white text-ink-muted-deep'}`}>
                                      {t === 'PORCENTAJE' ? '%' : '$'}
                                    </button>
                                  ))}
                                </div>
                                <input type="number" min={0} value={l.descValor}
                                  onChange={(e) => setLine(s.id, { descValor: e.target.value })}
                                  placeholder="Descuento" className="input-field w-[110px] text-sm" />
                                <input value={l.descMotivo}
                                  onChange={(e) => setLine(s.id, { descMotivo: e.target.value })}
                                  placeholder="Motivo" className="input-field flex-1 min-w-[120px] text-sm" />
                              </div>
                            )}

                            {l.extras.map((ex, i) => (
                              <div key={i} className="flex gap-2 mt-2">
                                <input value={ex.description} onChange={(e) => setLineExtra(s.id, i, { description: e.target.value })}
                                  placeholder="Adicional…" className="input-field flex-1 text-sm" />
                                <input type="number" min={0} value={ex.amount} onChange={(e) => setLineExtra(s.id, i, { amount: e.target.value })}
                                  placeholder="$ valor" className="input-field w-[110px] text-sm" />
                                <button type="button" onClick={() => removeLineExtra(s.id, i)}
                                  aria-label="Eliminar adicional" className="text-ink-muted-deep hover:text-red-700 px-1.5 text-lg leading-none">×</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addLineExtra(s.id)}
                              className="text-xs text-gold-deep hover:underline mt-2">+ Adicional a este servicio</button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Descuento al total (solo scope 'order') */}
                    {discountScope === 'order' && (
                      <div>
                        <span className="form-label !mb-1 block">Descuento al total</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex rounded-lg border border-beige-dark overflow-hidden shrink-0">
                            {(['PORCENTAJE', 'VALOR_FIJO'] as const).map((t) => (
                              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, descuentoTipo: t }))}
                                className={`px-3 py-2 text-sm ${form.descuentoTipo === t ? 'bg-gold text-ink' : 'bg-white text-ink-muted-deep'}`}>
                                {t === 'PORCENTAJE' ? '%' : '$'}
                              </button>
                            ))}
                          </div>
                          <input type="number" min={0} value={form.descuentoValor}
                            onChange={field('descuentoValor')}
                            placeholder={form.descuentoTipo === 'PORCENTAJE' ? '0–100' : '0'}
                            className={`input-field w-[120px] ${orderDiscountTooBig ? 'border-red-400' : ''}`} />
                          <input value={form.descuentoMotivo} onChange={field('descuentoMotivo')}
                            placeholder="Motivo (opcional)" className="input-field flex-1 min-w-[120px]" />
                        </div>
                        {orderDiscountTooBig && <p className="text-xs text-red-700 mt-1">El descuento no puede superar el subtotal.</p>}
                      </div>
                    )}

                    {/* Adicional de la cita (general, no atado a un servicio) */}
                    <AdicionalesEditor items={extras} onChange={setExtras}
                      open={extrasOpen} onAdd={showExtras} onRemove={hideExtras} />

                    {/* Desglose en vivo */}
                    <div className="bg-beige-pale rounded-lg px-4 py-3 text-sm space-y-1">
                      <div className="flex justify-between text-ink-muted-deep">
                        <span>Servicios</span><span>{formatPrice(breakdown.servicesSubtotal)}</span>
                      </div>
                      {breakdown.extrasTotal > 0 && (
                        <div className="flex justify-between text-ink-muted-deep">
                          <span>Adicionales</span><span>{formatPrice(breakdown.extrasTotal)}</span>
                        </div>
                      )}
                      {breakdown.discount > 0 && (
                        <div className="flex justify-between text-gold-dark">
                          <span>Descuento</span><span>−{formatPrice(breakdown.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-ink font-medium border-t border-beige-dark pt-1 mt-1">
                        <span>Total a cobrar</span><span>{formatPrice(breakdown.total)}</span>
                      </div>
                      {breakdown.total === 0 && breakdown.discount > 0 && (
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
                <p className="text-xs font-medium text-ink-muted-deep uppercase tracking-wider mb-2">
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
                          ? 'bg-gold text-ink border-gold'
                          : 'border-beige-dark text-ink-muted-deep hover:border-gold/50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Notificar al cliente (no aplica a citas pasadas ni sin email) */}
              {form.mode === 'UPCOMING' && (
                <label className={`flex items-start gap-2 text-sm text-ink-muted-deep ${form.clientEmail.trim() ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                  <input type="checkbox"
                    checked={form.notifyClient && !!form.clientEmail.trim()}
                    disabled={!form.clientEmail.trim()}
                    onChange={e => setForm(f => ({ ...f, notifyClient: e.target.checked }))}
                    className="mt-0.5 rounded border-beige-dark text-gold-deep focus:ring-gold/40" />
                  <span>Notificar al cliente por email{!form.clientEmail.trim() && ' (requiere email)'}</span>
                </label>
              )}

              {/* Notas */}
              <div>
                <label htmlFor="ma-notas" className="form-label">Notas internas</label>
                <textarea id="ma-notas" value={form.notes} onChange={field('notes')}
                  placeholder="Preferencias, alergias, observaciones..."
                  rows={2} className="input-field w-full resize-none" />
              </div>

              {/* Forzar horario — solo aplica a "Cita próxima" (una pasada no valida horario) */}
              {form.mode === 'UPCOMING' && (
                <label className="flex items-start gap-2 text-sm text-ink-muted-deep cursor-pointer">
                  <input type="checkbox" checked={form.skipAvailabilityCheck}
                    onChange={e => setForm(f => ({ ...f, skipAvailabilityCheck: e.target.checked }))}
                    className="mt-0.5 rounded border-beige-dark text-gold-deep focus:ring-gold/40" />
                  <span>Forzar (ignorar horario y disponibilidad)</span>
                </label>
              )}

              {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
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
                <SubmitButton type="submit" loading={saving} loadingLabel="Guardando…" className="btn-primary flex-1 disabled:opacity-50">
                  {form.mode === 'PAST' ? 'Registrar cita pasada' : 'Crear cita'}
                </SubmitButton>
              </div>
            </form>
        </Modal>
      )}
    </>
  )
}
