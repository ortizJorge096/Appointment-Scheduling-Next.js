'use client'
// src/app/admin/citas/[id]/page.tsx
// Appointment detail with actions: confirm, complete, cancel

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice, shortCode, toWhatsAppNumber } from '@/lib/utils'
import { computeAppointmentTotal } from '@/lib/discount'
import { STUDIO } from '@/lib/config'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { usePermissionGuard, useCan } from '@/components/admin/usePermissionGuard'
import { STATUS_LABEL, STATUS_CLASS } from '@/lib/appointmentStatus'
import AdicionalesEditor, { type Adicional } from '@/components/admin/AdicionalesEditor'
import type { AppointmentWithService, AppointmentStatus } from '@/types'

// Per-service discount + extras (keyed by AppointmentService id).
interface LineExtraInput { description: string; amount: string }
interface LineInput { descTipo: 'PORCENTAJE' | 'VALOR_FIJO'; descValor: string; descMotivo: string; extras: LineExtraInput[] }
const emptyLine = (): LineInput => ({ descTipo: 'PORCENTAJE', descValor: '', descMotivo: '', extras: [] })

const PAYMENT_STATUS_OPTS = [
  { v: 'PENDING', l: 'Sin pago' },
  { v: 'PAID',    l: 'Pagado' },
  { v: 'PARTIAL', l: 'Parcial' },
  { v: 'WAIVED',  l: 'Cortesía' },
]
const PAYMENT_METHOD_OPTS = [
  { v: 'EFECTIVO',      l: 'Efectivo' },
  { v: 'TRANSFERENCIA', l: 'Transferencia' },
  { v: 'TARJETA',       l: 'Tarjeta' },
  { v: 'NEQUI',         l: 'Nequi' },
  { v: 'DAVIPLATA',     l: 'Daviplata' },
]


// Available actions based on current status
const ACTIONS: Record<string, { label: string; status: AppointmentStatus; style: string }[]> = {
  PENDING: [
    { label: 'Confirmar',  status: 'CONFIRMED', style: 'btn-primary' },
    { label: 'Cancelar',   status: 'CANCELLED', style: 'border border-red-300 text-red-500 px-6 py-3 sm:py-2.5 text-xs tracking-widest uppercase hover:bg-red-50 transition-colors' },
  ],
  // No "Completar" here — registering the payment completes the appointment
  // (see the payment form). Completing without charge = pay $0 + "Cortesía".
  CONFIRMED: [
    { label: 'No asistió', status: 'NO_SHOW',   style: 'border border-gray-300 text-gray-500 px-6 py-3 sm:py-2.5 text-xs tracking-widest uppercase hover:bg-gray-50 transition-colors' },
    { label: 'Cancelar',   status: 'CANCELLED', style: 'border border-red-300 text-red-500 px-6 py-3 sm:py-2.5 text-xs tracking-widest uppercase hover:bg-red-50 transition-colors' },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW:   [],
}

export default function CitaDetailPage() {
  usePermissionGuard('citas:ver')
  const { id }    = useParams<{ id: string }>()
  const confirm   = useConfirm()
  const toast     = useToast()
  const router    = useRouter()
  const can       = useCan()

  const [appt, setAppt]         = useState<AppointmentWithService | null>(null)
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [notes, setNotes]       = useState('')
  const [editNotes, setEditNotes] = useState(false)

  // Payment form
  const [payStatus, setPayStatus] = useState('PENDING')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('')
  const [savingPay, setSavingPay] = useState(false)

  // Order-level (total) discount
  const [discTipo, setDiscTipo]     = useState<'PORCENTAJE' | 'VALOR_FIJO'>('PORCENTAJE')
  const [discValor, setDiscValor]   = useState('')
  const [discMotivo, setDiscMotivo] = useState('')

  // General adicionales (collapsible)
  const [extras, setExtras]         = useState<Adicional[]>([])
  const [extrasOpen, setExtrasOpen] = useState(false)

  // Per-service discount + extras, keyed by AppointmentService id.
  const [lines, setLines] = useState<Record<string, LineInput>>({})
  const [discountScope, setDiscountScope] = useState<'none' | 'line' | 'order'>('none')

  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) { setAppt(json.data); setNotes(json.data.notes ?? '') }
        else setError('Cita no encontrada')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [id])

  // Keep the payment form in sync with the loaded appointment
  useEffect(() => {
    if (!appt) return
    setPayStatus(appt.paymentStatus)
    setPayAmount(appt.amountPaid != null ? String(appt.amountPaid) : '')
    setPayMethod(appt.paymentMethod ?? '')
    setDiscTipo((appt.descuentoTipo as 'PORCENTAJE' | 'VALOR_FIJO') ?? 'PORCENTAJE')
    setDiscValor(appt.descuentoValor != null ? String(appt.descuentoValor) : '')
    setDiscMotivo(appt.descuentoMotivo ?? '')

    // General extras (not tied to a service line).
    const allExtras = appt.extras ?? []
    const generalExtras = allExtras.filter((e) => !e.appointmentServiceId)
      .map((e) => ({ description: e.description, amount: String(e.amount) }))
    setExtras(generalExtras)
    setExtrasOpen(generalExtras.length > 0)

    // Per-service discount + extras, from the saved AppointmentService rows.
    const svcRows = appt.services ?? []
    const initLines: Record<string, LineInput> = {}
    let anyLineDiscount = false
    for (const sv of svcRows) {
      if (sv.descuentoValor != null) anyLineDiscount = true
      initLines[sv.id] = {
        descTipo:   (sv.descuentoTipo as 'PORCENTAJE' | 'VALOR_FIJO') ?? 'PORCENTAJE',
        descValor:  sv.descuentoValor != null ? String(sv.descuentoValor) : '',
        descMotivo: sv.descuentoMotivo ?? '',
        extras: allExtras.filter((e) => e.appointmentServiceId === sv.id)
          .map((e) => ({ description: e.description, amount: String(e.amount) })),
      }
    }
    setLines(initLines)
    setDiscountScope(appt.descuentoValor != null ? 'order' : anyLineDiscount ? 'line' : 'none')
  }, [appt])

  async function updateStatus(status: AppointmentStatus) {
    const ok = await confirm({
      message: `¿Cambiar el estado de esta cita a "${STATUS_LABEL[status]}"?`,
      confirmLabel: STATUS_LABEL[status],
      danger: status === 'CANCELLED',
    })
    if (!ok) return
    setUpdating(true)
    const res  = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = await res.json()
    setUpdating(false)
    if (!json.success) { toast.error(json.error ?? 'No se pudo actualizar la cita'); return }
    setAppt(json.data)
    toast.success(`Cita marcada como ${STATUS_LABEL[status]}`)
    // Terminal states → back to the list (nothing else to do here).
    if (status === 'CANCELLED' || status === 'NO_SHOW') router.push('/admin/citas')
  }

  async function saveNotes() {
    setUpdating(true)
    const res  = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    const json = await res.json()
    setUpdating(false)
    if (!json.success) { toast.error(json.error ?? 'No se pudieron guardar las notas'); return }
    setAppt(json.data); setEditNotes(false)
    toast.success('Notas guardadas')
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault()
    if (orderDiscountTooBig) { toast.error('El descuento al total no puede superar el subtotal.'); return }
    setSavingPay(true)
    const svcRows = appt?.services ?? []
    const payload: Record<string, unknown> = {
      paymentStatus: payStatus,
      amountPaid:    payAmount ? parseInt(payAmount) : null,
      paymentMethod: payMethod || null,
      // General extras (not tied to a service line).
      extras: extras
        .filter((e) => e.description.trim() && Number(e.amount) > 0)
        .map((e) => ({ description: e.description.trim(), amount: Number(e.amount) })),
      // Per-service discount + extras (extras always sent → replaces the line's set).
      services: svcRows.map((sv) => {
        const l = lines[sv.id]
        const lineDisc = discountScope === 'line' && !!l && Number(l.descValor) > 0
        return {
          appointmentServiceId: sv.id,
          ...(lineDisc ? { descuentoTipo: l!.descTipo, descuentoValor: Number(l!.descValor), descuentoMotivo: l!.descMotivo.trim() || undefined } : {}),
          extras: (l?.extras ?? [])
            .filter((e) => e.description.trim() && Number(e.amount) > 0)
            .map((e) => ({ description: e.description.trim(), amount: Number(e.amount) })),
        }
      }),
      // Order-level discount (cleared when not in 'order' scope).
      ...(discountScope === 'order' && Number(discValor) > 0
        ? { descuentoTipo: discTipo, descuentoValor: Number(discValor), descuentoMotivo: discMotivo.trim() || undefined }
        : { descuentoTipo: null, descuentoValor: null, descuentoMotivo: null }),
    }
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSavingPay(false)
    if (!json.success) { toast.error(json.error ?? 'No se pudo guardar el pago'); return }
    setAppt(json.data)
    if (json.data.status === 'COMPLETED') {
      toast.success('Pago registrado — cita completada')
      router.push('/admin/citas')
    } else {
      toast.success('Pago guardado')
    }
  }

  // ── Per-service discount/extras helpers ──
  function setLine(sid: string, patch: Partial<LineInput>) {
    setLines((prev) => ({ ...prev, [sid]: { ...(prev[sid] ?? emptyLine()), ...patch } }))
  }
  function addLineExtra(sid: string) {
    setLines((prev) => {
      const l = prev[sid] ?? emptyLine()
      return { ...prev, [sid]: { ...l, extras: [...l.extras, { description: '', amount: '' }] } }
    })
  }
  function setLineExtra(sid: string, idx: number, patch: Partial<LineExtraInput>) {
    setLines((prev) => {
      const l = prev[sid] ?? emptyLine()
      return { ...prev, [sid]: { ...l, extras: l.extras.map((e, i) => (i === idx ? { ...e, ...patch } : e)) } }
    })
  }
  function removeLineExtra(sid: string, idx: number) {
    setLines((prev) => {
      const l = prev[sid] ?? emptyLine()
      return { ...prev, [sid]: { ...l, extras: l.extras.filter((_, i) => i !== idx) } }
    })
  }
  // Discount scopes are exclusive: switching clears the other scope's values.
  function changeScope(scope: 'none' | 'line' | 'order') {
    setDiscountScope(scope)
    if (scope !== 'order') { setDiscValor(''); setDiscMotivo('') }
    if (scope !== 'line') setLines((prev) => Object.fromEntries(
      Object.entries(prev).map(([k, l]) => [k, { ...l, descValor: '', descMotivo: '' }]),
    ))
  }

  // Expand the adicionales block and seed the first empty row right away, so
  // the click that opens the section lands directly on an input — same as
  // "+ Agregar descuento", which shows its inputs in one click.
  function showExtras() {
    setExtras((e) => (e.length > 0 ? e : [{ description: '', amount: '' }]))
    setExtrasOpen(true)
  }

  // Collapse the adicionales block, discarding any blank draft row left
  // untouched (mirrors removeDiscount clearing unsaved discount inputs).
  function hideExtras() {
    setExtras((e) => e.filter((it) => it.description.trim() || it.amount.trim()))
    setExtrasOpen(false)
  }

  // Quick action: mark the computed (discounted) total as paid.
  function markPaidFull() {
    setPayStatus('PAID')
    setPayAmount(String(breakdown.total))
    if (!payMethod) setPayMethod('EFECTIVO')
  }

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto flex items-center gap-3 text-ink-muted">
      <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      Cargando cita...
    </div>
  )

  if (error || !appt) return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <p className="text-red-500 mb-4">{error ?? 'Error'}</p>
      <Link href="/admin/citas" className="btn-secondary">← Volver</Link>
    </div>
  )

  const actions = ACTIONS[appt.status] ?? []
  // Cancelling needs citas:cancelar; every other status change needs citas:editar.
  const visibleActions = actions.filter((a) =>
    a.status === 'CANCELLED' ? can('citas:cancelar') : can('citas:editar'))

  // Live money breakdown, mirroring the API (per-line OR order discount + extras).
  const svcRows = appt.services ?? []
  const calcLines = svcRows.length > 0
    ? svcRows.map((sv) => {
        const l = lines[sv.id]
        const lineDisc = discountScope === 'line' && !!l && Number(l.descValor) > 0
        return {
          price:          sv.price,
          descuentoTipo:  lineDisc ? l!.descTipo : null,
          descuentoValor: lineDisc ? Number(l!.descValor) : null,
          extras:         (l?.extras ?? []).filter((e) => e.description.trim() && Number(e.amount) > 0).map((e) => Number(e.amount)),
        }
      })
    : [{ price: appt.service.price, descuentoTipo: null, descuentoValor: null, extras: [] as number[] }]
  const generalExtraAmts = extras.filter((e) => e.description.trim() && Number(e.amount) > 0).map((e) => Number(e.amount))
  const orderDiscount = discountScope === 'order' ? { tipo: discTipo, valor: Number(discValor) || 0 } : undefined
  const breakdown = computeAppointmentTotal(calcLines, generalExtraAmts, orderDiscount)
  const orderBase = breakdown.servicesSubtotal + breakdown.extrasTotal
  const orderDiscountTooBig = discountScope === 'order' && discTipo === 'VALOR_FIJO' && (Number(discValor) || 0) > orderBase

  // Saved (persisted) breakdown — powers the read-only SERVICIOS summary card,
  // so it reflects the discount actually stored on the appointment.
  const savedBreakdown = computeAppointmentTotal(
    svcRows.length > 0
      ? svcRows.map((sv) => ({
          price: sv.price,
          descuentoTipo: sv.descuentoTipo ?? null,
          descuentoValor: sv.descuentoValor ?? null,
          extras: (appt.extras ?? []).filter((e) => e.appointmentServiceId === sv.id).map((e) => e.amount),
        }))
      : [{ price: appt.service.price, descuentoTipo: null, descuentoValor: null, extras: [] as number[] }],
    (appt.extras ?? []).filter((e) => !e.appointmentServiceId).map((e) => e.amount),
    appt.descuentoValor != null ? { tipo: appt.descuentoTipo, valor: appt.descuentoValor } : undefined,
  )

  // Quick WhatsApp link to the client, with a preloaded, appointment-specific
  // message. Only built when the stored phone normalizes to a valid number.
  const waNumber = toWhatsAppNumber(appt.clientPhone)
  const waServiceName = appt.services && appt.services.length > 1
    ? appt.services.map((s) => s.service.name).join(' + ')
    : appt.service.name
  const waDateLabel = format(new Date(appt.date), "EEEE d 'de' MMMM", { locale: es })
  const waUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        `Hola, te contactamos desde ${STUDIO.name} sobre tu cita de ${waServiceName} el ${waDateLabel} a las ${appt.startTime}. Código: #${shortCode(appt.id)}`
      )}`
    : null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
        <Link href="/admin/citas" className="hover:text-gold hover:underline">Citas</Link>
        <span>/</span>
        <span className="text-ink">{appt.clientName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl text-ink font-light mb-1">
            {appt.clientName}
          </h1>
          <p className="text-xs text-ink-muted tracking-wide">
            Código: {appt.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <span className={`${STATUS_CLASS[appt.status]} text-sm px-3 py-1.5`}>
          {STATUS_LABEL[appt.status]}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

        {/* Service */}
        <div className="bg-white rounded-xl border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">
            Servicio{appt.services && appt.services.length > 1 ? 's' : ''}
          </p>
          {svcRows.length > 0 ? (
            svcRows.map((s) => (
              <div key={s.id} className="flex justify-between gap-3 text-sm">
                <span className="text-ink">{s.service.name}</span>
                <span className="text-ink-muted whitespace-nowrap">{formatPrice(s.price)}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-ink">{appt.service.name}</span>
              <span className="text-ink-muted whitespace-nowrap">{formatPrice(appt.service.price)}</span>
            </div>
          )}

          {(appt.extras ?? []).length > 0 && (
            <div className="text-xs text-ink-muted mt-2 pt-2 border-t border-beige-dark space-y-0.5">
              {appt.extras!.map((e) => (
                <p key={e.id}>+ Adicional ({e.description}): {formatPrice(e.amount)}</p>
              ))}
            </div>
          )}

          {/* Subtotal / descuento / total (refleja el descuento guardado) */}
          <div className="mt-2 pt-2 border-t border-beige-dark text-sm space-y-1">
            {(savedBreakdown.discount > 0 || savedBreakdown.extrasTotal > 0) && (
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span>{formatPrice(savedBreakdown.servicesSubtotal + savedBreakdown.extrasTotal)}</span>
              </div>
            )}
            {savedBreakdown.discount > 0 && (
              <div className="flex justify-between text-gold-dark">
                <span>Descuento</span><span>−{formatPrice(savedBreakdown.discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-ink font-medium">Total</span>
              <span className="text-gold text-lg font-medium">{formatPrice(savedBreakdown.total)}</span>
            </div>
          </div>
        </div>

        {/* Date and time */}
        <div className="bg-white rounded-xl border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">Fecha y hora</p>
          <p className="font-serif text-xl text-ink first-letter:uppercase">
            {format(new Date(appt.date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-ink-muted text-sm mt-1">
            {appt.startTime} – {appt.endTime}
          </p>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">Contacto</p>
          {appt.clientEmail ? (
            <p className="text-ink text-sm">📧 {appt.clientEmail} <span className="text-xs text-green-600">· notificaciones activas</span></p>
          ) : (
            <p className="text-sm text-ink-muted italic">📵 Sin email — el cliente no recibe notificaciones</p>
          )}
          <div className="flex items-center justify-between gap-3 mt-1">
            <p className="text-ink text-sm">📱 {appt.clientPhone}</p>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gold border border-gold/40 rounded-full px-3 py-1.5 hover:bg-gold-pale transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                WhatsApp
              </a>
            ) : (
              <span className="text-xs text-ink-muted/60 italic shrink-0" title="No se puede abrir WhatsApp con un número incompleto">
                Teléfono incompleto
              </span>
            )}
          </div>
        </div>

        {/* Scheduling */}
        <div className="bg-white rounded-xl border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">Registro</p>
          <p className="text-xs text-ink-muted">
            Agendado el{' '}
            {format(new Date(appt.createdAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
          </p>
          {appt.confirmationSentAt && (
            <p className="text-xs text-green-600 mt-1">✓ Confirmación enviada</p>
          )}
          {appt.reminderSentAt && (
            <p className="text-xs text-blue-600 mt-1">✓ Recordatorio enviado</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-beige-dark p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-ink-muted uppercase tracking-widest">Notas</p>
          {!editNotes && can('citas:editar') && (
            <button
              onClick={() => setEditNotes(true)}
              className="text-xs text-gold hover:underline"
            >
              Editar
            </button>
          )}
        </div>
        {editNotes ? (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              className="input-field resize-none"
              placeholder="Agrega notas sobre la cita..."
            />
            <div className="flex gap-2">
              <button onClick={saveNotes} disabled={updating} className="btn-primary text-xs px-5 py-2.5 sm:py-2">
                {updating ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => { setEditNotes(false); setNotes(appt.notes ?? '') }}
                className="btn-secondary text-xs px-5 py-2">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted italic">
            {appt.notes || 'Sin notas.'}
          </p>
        )}
      </div>

      {/* Payment — only for roles that can register payments (citas:pago) */}
      {can('citas:pago') && (
      <form onSubmit={savePayment} className="bg-white rounded-xl border border-beige-dark p-5 mb-8">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <p className="text-xs text-ink-muted uppercase tracking-widest">Pago</p>
          <button type="button" onClick={markPaidFull}
            className="text-xs text-gold hover:underline">Marcar pagado (total)</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Estado</label>
            <select className="select-field" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
              {PAYMENT_STATUS_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Monto pagado (COP)</label>
            <input type="number" min={0} step={1} className="input-field" value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="form-label">Método</label>
            <select className="select-field" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="">—</option>
              {PAYMENT_METHOD_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </div>

        {/* Descuento: sin / por servicio / al total (excluyentes) */}
        <div className="mt-4">
          <span className="form-label !mb-1 block">Descuento</span>
          <div className="flex gap-2">
            {([['none', 'Sin descuento'], ['line', 'Por servicio'], ['order', 'Al total']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => changeScope(v)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs border transition-colors ${
                  discountScope === v ? 'bg-gold text-white border-gold' : 'border-beige-dark text-ink-muted hover:border-gold/50'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cada servicio: precio + descuento por línea (si aplica) + adicionales */}
        <div className="mt-3 space-y-2">
          {svcRows.map((sv) => {
            const l = lines[sv.id] ?? emptyLine()
            return (
              <div key={sv.id} className="border border-beige-dark rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-ink font-medium">{sv.service.name}</span>
                  <span className="text-ink-muted">{formatPrice(sv.price)}</span>
                </div>
                {discountScope === 'line' && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="flex rounded-lg border border-beige-dark overflow-hidden shrink-0">
                      {(['PORCENTAJE', 'VALOR_FIJO'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setLine(sv.id, { descTipo: t })}
                          className={`px-2.5 py-1.5 text-xs ${l.descTipo === t ? 'bg-gold text-white' : 'bg-white text-ink-muted'}`}>
                          {t === 'PORCENTAJE' ? '%' : '$'}
                        </button>
                      ))}
                    </div>
                    <input type="number" min={0} value={l.descValor}
                      onChange={(e) => setLine(sv.id, { descValor: e.target.value })}
                      placeholder="Descuento" className="input-field w-[110px] text-sm" />
                    <input value={l.descMotivo} onChange={(e) => setLine(sv.id, { descMotivo: e.target.value })}
                      placeholder="Motivo" className="input-field flex-1 min-w-[120px] text-sm" />
                  </div>
                )}
                {l.extras.map((ex, i) => (
                  <div key={i} className="flex gap-2 mt-2">
                    <input value={ex.description} onChange={(e) => setLineExtra(sv.id, i, { description: e.target.value })}
                      placeholder="Adicional…" className="input-field flex-1 text-sm" />
                    <input type="number" min={0} value={ex.amount} onChange={(e) => setLineExtra(sv.id, i, { amount: e.target.value })}
                      placeholder="$ valor" className="input-field w-[110px] text-sm" />
                    <button type="button" onClick={() => removeLineExtra(sv.id, i)} aria-label="Eliminar adicional"
                      className="text-ink-muted hover:text-red-500 px-1.5 text-lg leading-none">×</button>
                  </div>
                ))}
                <button type="button" onClick={() => addLineExtra(sv.id)} className="text-xs text-gold hover:underline mt-2">+ Adicional a este servicio</button>
              </div>
            )
          })}
        </div>

        {/* Descuento al total (scope 'order') */}
        {discountScope === 'order' && (
          <div className="mt-3">
            <span className="form-label !mb-1 block">Descuento al total</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-beige-dark overflow-hidden shrink-0">
                {(['PORCENTAJE', 'VALOR_FIJO'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setDiscTipo(t)}
                    className={`px-3 py-2 text-sm ${discTipo === t ? 'bg-gold text-white' : 'bg-white text-ink-muted'}`}>
                    {t === 'PORCENTAJE' ? '%' : '$'}
                  </button>
                ))}
              </div>
              <input type="number" min={0} value={discValor} onChange={(e) => setDiscValor(e.target.value)}
                placeholder={discTipo === 'PORCENTAJE' ? '0–100' : '0'}
                className={`input-field w-[120px] ${orderDiscountTooBig ? 'border-red-400' : ''}`} />
              <input value={discMotivo} onChange={(e) => setDiscMotivo(e.target.value)}
                placeholder="Motivo (opcional)" className="input-field flex-1 min-w-[120px]" />
            </div>
            {orderDiscountTooBig && <p className="text-xs text-red-500 mt-1">El descuento no puede superar el subtotal.</p>}
          </div>
        )}

        {/* Adicional de la cita (general) */}
        <div className="mt-4">
          <AdicionalesEditor items={extras} onChange={setExtras}
            open={extrasOpen} onAdd={showExtras} onRemove={hideExtras} />
        </div>

        {/* Breakdown */}
        <div className="bg-beige-pale rounded-lg px-4 py-3 text-sm space-y-1 mt-4">
          <div className="flex justify-between text-ink-muted">
            <span>Servicio{svcRows.length > 1 ? 's' : ''}</span>
            <span>{formatPrice(breakdown.servicesSubtotal)}</span>
          </div>
          {breakdown.extrasTotal > 0 && (
            <div className="flex justify-between text-ink-muted">
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
        </div>

        <button type="submit" disabled={savingPay || orderDiscountTooBig}
          className="btn-primary text-xs px-5 py-2.5 sm:py-2 mt-4 disabled:opacity-50">
          {savingPay ? 'Guardando...' : 'Guardar pago'}
        </button>
        <p className="text-[11px] text-ink-muted/70 mt-2">
          Con pago <strong>Pagado</strong> o <strong>Cortesía</strong>, la cita se marca como completada automáticamente. Un abono <strong>Parcial</strong> no la completa.
        </p>
      </form>
      )}

      {/* Status actions */}
      {visibleActions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {visibleActions.map((action) => (
            <button
              key={action.status}
              onClick={() => updateStatus(action.status)}
              disabled={updating}
              className={action.style}
            >
              {updating ? '...' : action.label}
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
