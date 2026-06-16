'use client'
// src/app/admin/(protected)/clientes/[id]/page.tsx
// Full client history + internal notes editing

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import type { AppointmentWithService } from '@/types'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700', CONFIRMED: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700', CANCELLED: 'bg-gray-100 text-gray-500',
  NO_SHOW: 'bg-red-50 text-red-600',
}
const PAYMENT_LABEL: Record<string, string> = {
  PENDING: 'Sin pago', PAID: 'Pagado', PARTIAL: 'Parcial', WAIVED: 'Cortesía',
}
const PAYMENT_COLOR: Record<string, string> = {
  PENDING: 'text-orange-600', PAID: 'text-green-600',
  PARTIAL: 'text-blue-600', WAIVED: 'text-purple-600',
}

interface ClientData {
  id: string; name: string; email: string; phone: string | null; notes: string | null
  createdAt: string; appointments: AppointmentWithService[]
  _count: { appointments: number }
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [client, setClient]     = useState<ClientData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState('')

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) { setClient(j.data); setNotes(j.data.notes ?? '') }
      })
      .finally(() => setLoading(false))
  }, [id])

  async function saveNotes() {
    setSaving(true); setSaveMsg('')
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    const j = await res.json()
    setSaving(false)
    setSaveMsg(j.success ? 'Guardado ✓' : 'Error al guardar')
    if (j.success) setClient(prev => prev ? { ...prev, notes } : prev)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  if (loading) return <div className="p-6 text-ink-muted">Cargando…</div>
  if (!client) return <div className="p-6 text-ink-muted">Cliente no encontrado.</div>

  const totalSpent = client.appointments
    .filter(a => ['PAID', 'PARTIAL'].includes(a.paymentStatus))
    .reduce((sum, a) => sum + (a.amountPaid ?? a.service.price), 0)

  const completed = client.appointments.filter(a => a.status === 'COMPLETED').length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-xs text-ink-muted mb-4">
        <Link href="/admin/clientes" className="hover:text-gold">Clientes</Link>
        <span className="mx-1.5">›</span>
        <span>{client.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-beige-dark p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif text-ink">{client.name}</h1>
            <p className="text-sm text-ink-muted mt-1">{client.email}</p>
            {client.phone && <p className="text-sm text-ink-muted">{client.phone}</p>}
            <p className="text-xs text-ink-muted/60 mt-2">
              Cliente desde {new Date(client.createdAt).toLocaleDateString('es-CO', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex gap-6 text-center shrink-0">
            <div>
              <p className="text-2xl font-serif text-ink">{client._count.appointments}</p>
              <p className="text-xs text-ink-muted">citas</p>
            </div>
            <div>
              <p className="text-2xl font-serif text-ink">{completed}</p>
              <p className="text-xs text-ink-muted">completadas</p>
            </div>
            <div>
              <p className="text-2xl font-serif text-gold">{COP(totalSpent)}</p>
              <p className="text-xs text-ink-muted">total pagado</p>
            </div>
          </div>
        </div>

        {/* Notas internas */}
        <div className="mt-5 pt-5 border-t border-beige-dark">
          <label className="block text-xs font-medium text-ink-mid mb-1.5">
            Notas internas (no visibles al cliente)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Alergias, preferencias, observaciones…"
            className="w-full border border-beige-dark rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
          />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={saveNotes} disabled={saving}
              className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar notas'}
            </button>
            {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
          </div>
        </div>
      </div>

      {/* Historial de citas */}
      <h2 className="text-lg font-serif text-ink mb-3">Historial de citas</h2>
      {client.appointments.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin citas registradas.</p>
      ) : (
        <div className="space-y-3">
          {client.appointments.map(apt => (
            <div key={apt.id} className="bg-white rounded-xl border border-beige-dark p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-ink text-sm">{apt.service.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[apt.status]}`}>
                    {STATUS_LABEL[apt.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {new Date(apt.date).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}
                  {apt.startTime} – {apt.endTime}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-medium ${PAYMENT_COLOR[apt.paymentStatus]}`}>
                  {PAYMENT_LABEL[apt.paymentStatus]}
                </p>
                <p className="text-xs text-ink-muted">
                  {COP(apt.amountPaid ?? apt.service.price)}
                </p>
              </div>
              <Link href={`/admin/citas/${apt.id}`}
                className="text-xs text-gold hover:underline shrink-0">
                Ver →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
