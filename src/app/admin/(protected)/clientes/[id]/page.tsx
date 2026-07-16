'use client'
// src/app/admin/(protected)/clientes/[id]/page.tsx
// Full client history + internal notes editing

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { StatusBadge, PaymentBadge } from '@/components/ui/StatusBadge'
import type { AppointmentWithService } from '@/types'
import { usePermissionGuard, useCan } from '@/components/admin/usePermissionGuard'
import { formatPrice } from '@/lib/utils'


interface ClientData {
  id: string; name: string; email: string | null; phone: string | null; notes: string | null
  createdAt: string; deletedAt?: string | null; appointments: AppointmentWithService[]
  _count: { appointments: number }
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  usePermissionGuard('clientes:ver')
  const can = useCan()
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

  // Archive / delete (admin management)
  const [busy, setBusy]           = useState(false)
  const [actionMsg, setActionMsg] = useState('')

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
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const j = await res.json()
      setSaveMsg(j.success ? 'Guardado ✓' : 'Error al guardar')
      if (j.success) setClient(prev => prev ? { ...prev, notes } : prev)
    } catch {
      setSaveMsg('Error al guardar')
    } finally {
      setSaving(false)
    }
    setTimeout(() => setSaveMsg(''), 3000)
  }

  function openEditInfo() {
    if (!client) return
    setInfoForm({ name: client.name, email: client.email ?? '', phone: client.phone ?? '' })
    setInfoErr('')
    setEditInfo(true)
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingInfo(true); setInfoErr('')
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:  infoForm.name.trim(),
          email: infoForm.email.trim() || undefined,
          phone: infoForm.phone.trim() || undefined,
        }),
      })
      const j = await res.json()
      if (!j.success) { setInfoErr(j.error ?? 'No se pudo guardar'); return }
      setClient(prev => prev
        ? { ...prev, name: infoForm.name.trim(), email: infoForm.email.trim() || null, phone: infoForm.phone.trim() || null }
        : prev)
      setEditInfo(false)
    } catch {
      setInfoErr('Error de conexión. Intenta de nuevo.')
    } finally {
      setSavingInfo(false)
    }
  }

  // Archive/reactivate: toggles the client's soft-delete flag (kept in the DB).
  async function toggleArchive(archived: boolean) {
    // Heads-up when archiving a client who still has upcoming appointments: they
    // stay scheduled (we never auto-cancel), but the admin should know before hiding them.
    if (archived && client) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const upcoming = client.appointments.filter(
        (a) => (a.status === 'PENDING' || a.status === 'CONFIRMED') && new Date(a.date) >= today,
      ).length
      if (upcoming > 0 && !confirm(
        `Este cliente tiene ${upcoming} cita${upcoming !== 1 ? 's' : ''} próxima${upcoming !== 1 ? 's' : ''} agendada${upcoming !== 1 ? 's' : ''}. ` +
        'Si lo archivas seguirán agendadas (no se cancelan). ¿Continuar?',
      )) return
    }
    setBusy(true); setActionMsg('')
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      })
      const j = await res.json()
      if (!j.success) { setActionMsg(j.error ?? 'No se pudo actualizar'); return }
      setClient(prev => prev ? { ...prev, deletedAt: archived ? new Date().toISOString() : null } : prev)
    } catch {
      setActionMsg('Error de conexión. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  // Hard-delete: only allowed when the client has no appointments (server enforces it too).
  async function remove() {
    if (!confirm('¿Eliminar este cliente definitivamente? Esta acción no se puede deshacer.')) return
    setBusy(true); setActionMsg('')
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!j.success) { setActionMsg(j.error ?? 'No se pudo eliminar'); return }
      window.location.href = '/admin/clientes'
    } catch {
      setActionMsg('Error de conexión. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto text-ink-muted-deep">Cargando…</div>
  if (!client) return <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto text-ink-muted-deep">Cliente no encontrado.</div>

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
      <div className="text-xs text-ink-muted-deep mb-4">
        <Link href="/admin/clientes" className="hover:text-gold-deep">Clientes</Link>
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
                  required placeholder="Nombre" className="input-field w-full" />
                <input type="email" value={infoForm.email} onChange={e => setInfoForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email (opcional)" className="input-field w-full" />
                <input value={infoForm.phone} onChange={e => setInfoForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Teléfono / celular" className="input-field w-full" />
                {infoErr && <p className="text-xs text-red-700">{infoErr}</p>}
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
                  {client.deletedAt && (
                    <span className="inline-block bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Archivado</span>
                  )}
                  {can('clientes:editar') && (
                    <button onClick={openEditInfo} className="btn-row-action text-xs text-gold-deep hover:underline">Editar datos</button>
                  )}
                </div>
                {client.email && <p className="text-sm text-ink-muted-deep mt-1">{client.email}</p>}
                {client.phone && <p className="text-sm text-ink-muted-deep">{client.phone}</p>}
                <p className="text-xs text-ink-muted-deep mt-2">
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
              <p className="text-xs text-ink-muted-deep">citas</p>
            </div>
            <div>
              <p className="text-2xl font-serif text-ink">{completed}</p>
              <p className="text-xs text-ink-muted-deep">completadas</p>
            </div>
            <div>
              <p className="text-2xl font-serif text-gold-deep">{formatPrice(totalSpent)}</p>
              <p className="text-xs text-ink-muted-deep">total pagado</p>
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
            readOnly={!can('clientes:editar')}
            placeholder="Alergias, preferencias, observaciones…"
            className="input-field w-full resize-none"
          />
          {can('clientes:editar') && (
            <div className="flex items-center gap-3 mt-2">
              <button onClick={saveNotes} disabled={saving}
                className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar notas'}
              </button>
              {saveMsg && <span className="text-xs text-green-700">{saveMsg}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Appointment history */}
      <h2 className="text-lg font-serif text-ink mb-3">Historial de citas</h2>
      {client.appointments.length === 0 ? (
        <p className="text-sm text-ink-muted-deep">Sin citas registradas.</p>
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
                  <StatusBadge status={apt.status} />
                </div>
                <p className="text-xs text-ink-muted-deep mt-0.5">
                  {new Date(apt.date).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}
                  {apt.startTime} – {apt.endTime}
                </p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="text-right">
                  <PaymentBadge status={apt.paymentStatus} className="text-sm" />
                  <p className="text-xs text-ink-muted-deep">
                    {formatPrice(apt.amountPaid ?? getTotalPrice(apt))}
                  </p>
                </div>
                <Link href={`/admin/citas/${apt.id}`}
                  className="btn-row-action text-xs text-gold-deep hover:underline shrink-0">
                  Ver →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin management: archive / delete */}
      {can('clientes:editar') && (
        <div className="mt-8 bg-white rounded-xl border border-beige-dark p-5 sm:p-6">
          <h2 className="text-lg font-serif text-ink mb-1">Administración</h2>
          <p className="text-xs text-ink-muted-deep mb-4">
            Archiva un cliente para ocultarlo del directorio sin perder su historial. Eliminar es permanente.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {client.deletedAt ? (
              <button onClick={() => toggleArchive(false)} disabled={busy}
                className="btn-secondary text-sm disabled:opacity-50">
                Reactivar cliente
              </button>
            ) : (
              <button onClick={() => toggleArchive(true)} disabled={busy}
                className="btn-secondary text-sm disabled:opacity-50">
                Archivar cliente
              </button>
            )}
            <button onClick={remove}
              disabled={busy || client._count.appointments > 0}
              title={client._count.appointments > 0 ? 'Tiene citas registradas; archívalo en su lugar' : undefined}
              className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">
              Eliminar definitivamente
            </button>
          </div>
          {client._count.appointments > 0 && (
            <p className="text-xs text-ink-muted-deep mt-2">
              Tiene {client._count.appointments} cita{client._count.appointments !== 1 ? 's' : ''} registrada{client._count.appointments !== 1 ? 's' : ''}; no se puede eliminar. Archívalo para ocultarlo.
            </p>
          )}
          {actionMsg && <p className="text-xs text-red-700 mt-2">{actionMsg}</p>}
        </div>
      )}
    </div>
  )
}
