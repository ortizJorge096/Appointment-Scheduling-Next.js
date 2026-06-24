'use client'
// src/app/admin/citas/[id]/page.tsx
// Appointment detail with actions: confirm, complete, cancel

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { STATUS_LABEL, STATUS_CLASS } from '@/lib/appointmentStatus'
import type { AppointmentWithService, AppointmentStatus } from '@/types'

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
    { label: 'Cancelar',   status: 'CANCELLED', style: 'border border-red-300 text-red-500 px-6 py-2.5 text-xs tracking-widest uppercase hover:bg-red-50 transition-colors' },
  ],
  CONFIRMED: [
    { label: 'Completar',  status: 'COMPLETED', style: 'btn-primary' },
    { label: 'No asistió', status: 'NO_SHOW',   style: 'border border-gray-300 text-gray-500 px-6 py-2.5 text-xs tracking-widest uppercase hover:bg-gray-50 transition-colors' },
    { label: 'Cancelar',   status: 'CANCELLED', style: 'border border-red-300 text-red-500 px-6 py-2.5 text-xs tracking-widest uppercase hover:bg-red-50 transition-colors' },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW:   [],
}

export default function CitaDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const confirm   = useConfirm()

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
    if (json.success) setAppt(json.data)
    else setError(json.error)
    setUpdating(false)
  }

  async function saveNotes() {
    setUpdating(true)
    const res  = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    const json = await res.json()
    if (json.success) { setAppt(json.data); setEditNotes(false) }
    else setError(json.error)
    setUpdating(false)
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault()
    setSavingPay(true)
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: payStatus,
        amountPaid:    payAmount ? parseInt(payAmount) : null,
        paymentMethod: payMethod || null,
      }),
    })
    const json = await res.json()
    if (json.success) setAppt(json.data)
    else setError(json.error)
    setSavingPay(false)
  }

  // Quick action: mark the full service price as paid
  function markPaidFull() {
    if (!appt) return
    const totalPrice = appt.services && appt.services.length > 1
      ? appt.services.reduce((sum, s) => sum + s.price, 0)
      : appt.service.price
    setPayStatus('PAID')
    setPayAmount(String(totalPrice))
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-muted mb-6">
        <Link href="/admin/citas" className="hover:text-gold">Citas</Link>
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
          {appt.services && appt.services.length > 1 ? (
            <>
              {appt.services.map((s) => (
                <p key={s.id} className="text-sm text-ink">{s.service.name}</p>
              ))}
              <p className="text-gold text-lg font-medium mt-1">
                {formatPrice(appt.services.reduce((sum, s) => sum + s.price, 0))}
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-xl text-ink mb-0.5">{appt.service.name}</p>
              <p className="text-gold text-lg font-medium">{formatPrice(appt.service.price)}</p>
              <p className="text-xs text-ink-muted mt-0.5">{appt.service.durationMinutes} min</p>
            </>
          )}
          {appt.extraAmount != null && appt.extraAmount > 0 && (
            <p className="text-xs text-ink-muted mt-2 pt-2 border-t border-beige-dark">
              + Adicional{appt.extraDescription ? ` (${appt.extraDescription})` : ''}: {formatPrice(appt.extraAmount)}
            </p>
          )}
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
          <p className="text-ink text-sm mt-1">{appt.clientPhone}</p>
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
          {!editNotes && (
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
              className="input-field resize-none text-sm"
              placeholder="Agrega notas sobre la cita..."
            />
            <div className="flex gap-2">
              <button onClick={saveNotes} disabled={updating} className="btn-primary text-xs px-5 py-2">
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

      {/* Payment */}
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
            <input type="number" min={0} step={1000} className="input-field" value={payAmount}
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
        <button type="submit" disabled={savingPay}
          className="btn-primary text-xs px-5 py-2 mt-4 disabled:opacity-50">
          {savingPay ? 'Guardando...' : 'Guardar pago'}
        </button>
      </form>

      {/* Status actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
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
