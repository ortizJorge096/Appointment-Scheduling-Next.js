'use client'
// src/app/admin/citas/[id]/page.tsx
// Appointment detail with actions: confirm, complete, cancel

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AppointmentWithService, AppointmentStatus } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW:   'No asistió',
}

const STATUS_CLASS: Record<string, string> = {
  PENDING:   'badge-pending',
  CONFIRMED: 'badge-confirmed',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
  NO_SHOW:   'badge-no_show',
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

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

  const [appt, setAppt]         = useState<AppointmentWithService | null>(null)
  const [loading, setLoading]   = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [notes, setNotes]       = useState('')
  const [editNotes, setEditNotes] = useState(false)

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

  async function updateStatus(status: AppointmentStatus) {
    if (!confirm(`¿Cambiar estado a "${STATUS_LABEL[status]}"?`)) return
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

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-ink-muted">
      <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      Cargando cita...
    </div>
  )

  if (error || !appt) return (
    <div className="p-8">
      <p className="text-red-500 mb-4">{error ?? 'Error'}</p>
      <Link href="/admin/citas" className="btn-secondary">← Volver</Link>
    </div>
  )

  const actions = ACTIONS[appt.status] ?? []

  return (
    <div className="p-8 max-w-3xl">

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
        <div className="bg-white border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">Servicio</p>
          <p className="font-serif text-xl text-ink mb-0.5">{appt.service.name}</p>
          <p className="text-gold text-lg font-medium">{formatPrice(appt.service.price)}</p>
          <p className="text-xs text-ink-muted mt-0.5">{appt.service.durationMinutes} min</p>
        </div>

        {/* Date and time */}
        <div className="bg-white border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">Fecha y hora</p>
          <p className="font-serif text-xl text-ink capitalize">
            {format(new Date(appt.date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-ink-muted text-sm mt-1">
            {appt.startTime} – {appt.endTime}
          </p>
        </div>

        {/* Contact */}
        <div className="bg-white border border-beige-dark p-5">
          <p className="text-xs text-ink-muted uppercase tracking-widest mb-3">Contacto</p>
          <p className="text-ink text-sm">{appt.clientEmail}</p>
          <p className="text-ink text-sm mt-1">{appt.clientPhone}</p>
        </div>

        {/* Scheduling */}
        <div className="bg-white border border-beige-dark p-5">
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
      <div className="bg-white border border-beige-dark p-5 mb-8">
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
