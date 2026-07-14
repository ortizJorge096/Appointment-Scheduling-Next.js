'use client'
// src/app/admin/horarios/page.tsx
// Schedule management by weekday and blocked dates

import { useState, useEffect } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePermissionGuard, useCan } from '@/components/admin/usePermissionGuard'
import { PageHeader } from '@/components/ui/PageHeader'

const DAYS = [
  { key: 'MONDAY',    label: 'Lunes'     },
  { key: 'TUESDAY',   label: 'Martes'    },
  { key: 'WEDNESDAY', label: 'Miércoles' },
  { key: 'THURSDAY',  label: 'Jueves'    },
  { key: 'FRIDAY',    label: 'Viernes'   },
  { key: 'SATURDAY',  label: 'Sábado'    },
  { key: 'SUNDAY',    label: 'Domingo'   },
]

interface Schedule {
  id?: string
  dayOfWeek: string
  startTime: string
  endTime: string
  breakStart: string | null
  breakEnd: string | null
  isActive: boolean
}

interface BlockedDate {
  id: string
  date: string
  reason: string | null
}

export default function HorariosPage() {
  usePermissionGuard('horarios:ver')
  const confirm = useConfirm()
  const can = useCan()
  const [schedules, setSchedules]       = useState<Schedule[]>([])
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState<string | null>(null)
  const [message, setMessage]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // New blocked date
  const [newBlock, setNewBlock] = useState({ date: '', reason: '' })
  const [addingBlock, setAddingBlock] = useState(false)

  function flash(type: 'ok' | 'err', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  async function load() {
    const [schRes, blkRes] = await Promise.all([
      fetch('/api/schedules'),
      fetch('/api/schedules/blocked'),
    ])
    const schJson = await schRes.json()
    const blkJson = await blkRes.json()

    if (schJson.success) {
      // Ensure every day has a record (even if empty)
      const map = Object.fromEntries(schJson.data.map((s: Schedule) => [s.dayOfWeek, s]))
      setSchedules(
        DAYS.map((d) => map[d.key] ?? { dayOfWeek: d.key, startTime: '09:00', endTime: '18:00', breakStart: null, breakEnd: null, isActive: false })
      )
    }

    if (blkJson.success) setBlockedDates(blkJson.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Update a schedule field locally
  function updateSchedule(day: string, field: keyof Schedule, value: string | boolean) {
    setSchedules((prev) =>
      prev.map((s) => s.dayOfWeek === day ? { ...s, [field]: value } : s)
    )
  }

  // Save a specific schedule
  async function saveSchedule(schedule: Schedule) {
    setSaving(schedule.dayOfWeek)
    const res  = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    })
    const json = await res.json()
    if (json.success) flash('ok', `Horario del ${DAYS.find(d => d.key === schedule.dayOfWeek)?.label} guardado`)
    else flash('err', json.error ?? 'Error al guardar')
    setSaving(null)
  }

  // Add blocked date
  async function addBlockedDate() {
    if (!newBlock.date) { flash('err', 'Selecciona una fecha'); return }
    setAddingBlock(true)
    const res  = await fetch('/api/schedules/blocked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBlock),
    })
    const json = await res.json()
    if (json.success) {
      flash('ok', 'Fecha bloqueada')
      setNewBlock({ date: '', reason: '' })
      load()
    } else {
      flash('err', json.error ?? 'Error')
    }
    setAddingBlock(false)
  }

  // Remove blocked date
  async function removeBlockedDate(id: string) {
    const ok = await confirm({ message: '¿Desbloquear esta fecha? Volverá a estar disponible para reservas.', confirmLabel: 'Desbloquear' })
    if (!ok) return
    const res = await fetch(`/api/schedules/blocked/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { flash('ok', 'Fecha desbloqueada'); load() }
    else flash('err', json.error ?? 'Error')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <PageHeader className="mb-6 sm:mb-8" eyebrow="Configuración" title="Horarios" />

      {/* Flash message */}
      {message && (
        <div className={`text-sm px-4 py-3 mb-5 border ${
          message.type === 'ok'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {message.type === 'ok' ? '✓ ' : '✗ '}{message.text}
        </div>
      )}

      {loading ? (
        <div className="text-ink-muted text-sm">Cargando horarios...</div>
      ) : (
        <>
          {/* ── Daily schedules ── */}
          <section className="bg-white rounded-xl border border-beige-dark overflow-hidden mb-10">
            <div className="px-5 sm:px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink font-light">Días de atención</h2>
              <p className="text-xs text-ink-muted mt-0.5">Guarda cada día por separado.</p>
            </div>

            <div className="divide-y divide-beige-dark">
              {schedules.map((sched) => {
                const dayLabel = DAYS.find((d) => d.key === sched.dayOfWeek)?.label ?? sched.dayOfWeek
                return (
                  <div key={sched.dayOfWeek}
                    className={`px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-opacity
                      ${sched.isActive ? '' : 'opacity-50'}`}>

                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer min-w-[100px]">
                        <input
                          type="checkbox"
                          checked={sched.isActive}
                          onChange={(e) => updateSchedule(sched.dayOfWeek, 'isActive', e.target.checked)}
                          className="accent-gold w-4 h-4"
                        />
                        <span className="text-sm font-medium text-ink">{dayLabel}</span>
                      </label>

                      <div className="flex items-center gap-2 text-sm text-ink-muted">
                        <input
                          type="time"
                          value={sched.startTime}
                          disabled={!sched.isActive}
                          onChange={(e) => updateSchedule(sched.dayOfWeek, 'startTime', e.target.value)}
                          className="input-field py-1.5 w-24 sm:w-28"
                        />
                        <span>–</span>
                        <input
                          type="time"
                          value={sched.endTime}
                          disabled={!sched.isActive}
                          onChange={(e) => updateSchedule(sched.dayOfWeek, 'endTime', e.target.value)}
                          className="input-field py-1.5 w-24 sm:w-28"
                        />
                      </div>
                    </div>

                    {/* Optional lunch break — leave both empty for a continuous day */}
                    <div className="flex items-center gap-2 text-sm text-ink-muted">
                      <span className="text-[10px] uppercase tracking-wider text-ink-muted/70 min-w-[64px]">Descanso</span>
                      <input type="time" value={sched.breakStart ?? ''} disabled={!sched.isActive}
                        onChange={(e) => updateSchedule(sched.dayOfWeek, 'breakStart', e.target.value)}
                        className="input-field py-1.5 w-24 sm:w-28" />
                      <span>–</span>
                      <input type="time" value={sched.breakEnd ?? ''} disabled={!sched.isActive}
                        onChange={(e) => updateSchedule(sched.dayOfWeek, 'breakEnd', e.target.value)}
                        className="input-field py-1.5 w-24 sm:w-28" />
                    </div>

                    {can('horarios:editar') && (
                    <button
                      onClick={() => saveSchedule(sched)}
                      disabled={saving === sched.dayOfWeek}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
                    >
                      {saving === sched.dayOfWeek ? 'Guardando...' : 'Guardar'}
                    </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Blocked dates ── */}
          <section className="bg-white rounded-xl border border-beige-dark overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink font-light">Fechas bloqueadas</h2>
              <p className="text-xs text-ink-muted mt-0.5">Festivos, vacaciones o días sin atención.</p>
            </div>

            {can('horarios:editar') && (
            <div className="px-4 sm:px-6 py-4 border-b border-beige-dark flex flex-wrap gap-3 items-end">
              <div>
                <label className="form-label text-[10px]">Fecha</label>
                <input
                  type="date"
                  value={newBlock.date}
                  onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })}
                  className="input-field py-1.5 w-36 sm:w-40"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="form-label text-[10px]">Motivo (opcional)</label>
                <input
                  type="text"
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                  className="input-field py-1.5"
                  placeholder="Ej: Festivo, vacaciones..."
                />
              </div>
              <button
                onClick={addBlockedDate}
                disabled={addingBlock}
                className="btn-primary text-xs px-4 py-2.5"
              >
                {addingBlock ? '...' : 'Bloquear'}
              </button>
            </div>
            )}

            {blockedDates.length === 0 ? (
              <div className="px-6 py-8 text-center text-ink-muted text-sm">
                No hay fechas bloqueadas.
              </div>
            ) : (
              <div className="divide-y divide-beige-dark">
                {blockedDates.map((b) => (
                  <div key={b.id} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {/* b.date is a full ISO datetime from the serialized DateTime;
                            take just the day part before rebuilding at local noon. */}
                        {new Date(`${b.date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                      {b.reason && (
                        <p className="text-xs text-ink-muted mt-0.5 truncate">{b.reason}</p>
                      )}
                    </div>
                    {can('horarios:editar') && (
                    <button
                      onClick={() => removeBlockedDate(b.id)}
                      className="btn-row-action text-xs text-red-400 hover:text-red-600 shrink-0"
                    >
                      Desbloquear
                    </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
