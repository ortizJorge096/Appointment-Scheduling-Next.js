'use client'
// src/app/admin/(protected)/clientes/[id]/page.tsx
// Full client history + internal notes editing

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { STATUS_LABEL, STATUS_CLASS } from '@/lib/appointmentStatus'
import type { AppointmentWithService } from '@/types'

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
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

  // Edit contact info (name / email / phone)
  const [editInfo, setEditInfo]   = useState(false)
  const [infoForm, setInfoForm]   = useState({ name: '', email: '', phone: '' })
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoErr, setInfoErr]     = useState('')

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

  function openEditInfo() {
    if (!client) return
    setInfoForm({ name: client.name, email: client.email, phone: client.phone ?? '' })
    setInfoErr('')
    setEditInfo(true)
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingInfo(true); setInfoErr('')
    const res = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:  infoForm.name.trim(),
        email: infoForm.email.trim(),
        phone: infoForm.phone.trim() || undefined,
      }),
    })
    const j = await res.json()
    setSavingInfo(false)
    if (!j.success) { setInfoErr(j.error ?? 'No se pudo guardar'); return }
    setClient(prev => prev
      ? { ...prev, name: infoForm.name.trim(), email: infoForm.email.trim(), phone: infoForm.phone.trim() || null }
      : prev)
    setEditInfo(false)
  }

  if (loading) return <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto text-ink-muted">Cargando…</div>
  if (!client) return <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto text-ink-muted">Cliente no encontrado.</div>

  // Helper to get total price from appointment (supports multi-service)
  function getTotalPrice(a: AppointmentWithService): number {
    if (a.services && a.services.length > 1) {
      return a.services.reduce((sum, s) => sum + s.price, 0)
    }
    return a.service.price
  }

  const totalSpent = client.appointments
    .filter(a => ['PAID', 'PARTIAL'].includes(a.paymentStatus))
    .reduce((sum, a) => sum + (a.amountPaid ?? getTotalPrice(a)), 0)

  const completed = client.appointments.filter(a => a.status === 'COMPLETED').length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-xs text-ink-muted mb-4">
        <Link href="/admin/clientes" className="hover:text-gold">Clientes</Link>
        <span className="mx-1.5">›</span>
        <span>{client.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-beige-dark p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editInfo ? (
              <form onSubmit={saveInfo} className="space-y-2 max-w-xs">
                <input value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))}
                  required placeholder="Nombre" className="input-field w-full text-sm" />
                <input type="email" value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))}
                  required placeholder="Email" className="input-field w-full text-sm" />
                <input value={infoForm.phone} onChange={e => setInfoForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Teléfono / celular" className="input-field w-full text-sm" />
                {infoErr && <p className="text-xs text-red-600">{infoErr}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={savingInfo} className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50">
                    {savingInfo ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" onClick={() => setEditInfo(false)} className="btn-secondary text-xs py-1.5 px-4">
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-serif text-ink">{client.name}</h1>
                  <button onClick={openEditInfo} className="btn-row-action text-xs text-gold hover:underline">Editar datos</button>
                </div>
                <p className="text-sm text-ink-muted mt-1">{client.email}</p>
                {client.phone && <p className="text-sm text-ink-muted">{client.phone}</p>}
                <p className="text-xs text-ink-muted/60 mt-2">
                  Cliente desde {new Date(client.createdAt).toLocaleDateString('es-CO', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </p>
              </>
            )}
          </div>
          <div className="flex gap-4 sm:gap-6 text-center shrink-0 mt-4 sm:mt-0">
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

        {/* Internal notes */}
        <div className="mt-5 pt-5 border-t border-beige-dark">
          <label className="form-label">
            Notas internas (no visibles al cliente)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Alergias, preferencias, observaciones…"
            className="input-field w-full resize-none text-sm"
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

      {/* Appointment history */}
      <h2 className="text-lg font-serif text-ink mb-3">Historial de citas</h2>
      {client.appointments.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin citas registradas.</p>
      ) : (
        <div className="space-y-3">
          {client.appointments.map(apt => (
            <div key={apt.id} className="bg-white rounded-xl border border-beige-dark p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-ink text-sm">
                    {apt.services && apt.services.length > 1
                      ? apt.services.map((s) => s.service.name).join(' + ')
                      : apt.service.name}
                  </p>
                  <span className={STATUS_CLASS[apt.status]}>
                    {STATUS_LABEL[apt.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {new Date(apt.date).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}
                  {apt.startTime} – {apt.endTime}
                </p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="text-right">
                  <p className={`text-sm font-medium ${PAYMENT_COLOR[apt.paymentStatus]}`}>
                    {PAYMENT_LABEL[apt.paymentStatus]}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {COP(apt.amountPaid ?? getTotalPrice(apt))}
                  </p>
                </div>
                <Link href={`/admin/citas/${apt.id}`}
                  className="btn-row-action text-xs text-gold hover:underline shrink-0">
                  Ver →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
