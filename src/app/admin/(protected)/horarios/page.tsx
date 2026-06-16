'use client'
// src/app/admin/horarios/page.tsx
// Schedule management by weekday and blocked dates

import { useState, useEffect } from 'react'

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
  isActive: boolean
}

interface BlockedDate {
  id: string
  date: string
  reason: string | null
}

export default function HorariosPage() {
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
        DAYS.map((d) => map[d.key] ?? { dayOfWeek: d.key, startTime: '09:00', endTime: '18:00', isActive: false })
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
    if (!confirm('¿Desbloquear esta fecha?')) return
    const res = await fetch(`/api/schedules/blocked/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { flash('ok', 'Fecha desbloqueada'); load() }
    else flash('err', json.error ?? 'Error')
  }

  return (
    <div className="p-8 max-w-3xl">

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Configuración</p>
        <h1 className="font-serif text-3xl text-ink font-light">Horarios</h1>
      </div>

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
          <section className="bg-white border border-beige-dark mb-10">
            <div className="px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink font-light">Días de atención</h2>
              <p className="text-xs text-ink-muted mt-0.5">Guarda cada día por separado.</p>
            </div>

            <div className="divide-y divide-beige-dark">
              {schedules.map((sched) => {
                const dayLabel = DAYS.find((d) => d.key === sched.dayOfWeek)?.label ?? sched.dayOfWeek
                return (
                  <div key={sched.dayOfWeek}
                    className={`px-6 py-4 flex flex-wrap items-center gap-4 transition-opacity
                      ${sched.isActive ? '' : 'opacity-50'}`}>

                    {/* Active toggle */}
                    <label className="flex items-center gap-2 cursor-pointer min-w-[100px]">
                      <input
                        type="checkbox"
                        checked={sched.isActive}
                        onChange={(e) => updateSchedule(sched.dayOfWeek, 'isActive', e.target.checked)}
                        className="accent-gold w-4 h-4"
                      />
                      <span className="text-sm font-medium text-ink">{dayLabel}</span>
                    </label>

                    {/* Hours */}
                    <div className="flex items-center gap-2 text-sm text-ink-muted">
                      <input
                        type="time"
                        value={sched.startTime}
                        disabled={!sched.isActive}
                        onChange={(e) => updateSchedule(sched.dayOfWeek, 'startTime', e.target.value)}
                        className="input-field py-1.5 w-28 text-sm"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={sched.endTime}
                        disabled={!sched.isActive}
                        onChange={(e) => updateSchedule(sched.dayOfWeek, 'endTime', e.target.value)}
                        className="input-field py-1.5 w-28 text-sm"
                      />
                    </div>

                    {/* Save */}
                    <button
                      onClick={() => saveSchedule(sched)}
                      disabled={saving === sched.dayOfWeek}
                      className="ml-auto text-xs text-gold border border-gold px-3 py-1.5
                                 hover:bg-gold hover:text-white transition-colors disabled:opacity-50"
                    >
                      {saving === sched.dayOfWeek ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Blocked dates ── */}
          <section className="bg-white border border-beige-dark">
            <div className="px-6 py-4 border-b border-beige-dark">
              <h2 className="font-serif text-xl text-ink font-light">Fechas bloqueadas</h2>
              <p className="text-xs text-ink-muted mt-0.5">Festivos, vacaciones o días sin atención.</p>
            </div>

            {/* Add new date */}
            <div className="px-6 py-4 border-b border-beige-dark flex flex-wrap gap-3 items-end">
              <div>
                <label className="form-label text-[10px]">Fecha</label>
                <input
                  type="date"
                  value={newBlock.date}
                  onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })}
                  className="input-field py-1.5 w-40 text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="form-label text-[10px]">Motivo (opcional)</label>
                <input
                  type="text"
                  value={newBlock.reason}
                  onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                  className="input-field py-1.5 text-sm"
                  placeholder="Ej: Festivo, vacaciones..."
                />
              </div>
              <button
                onClick={addBlockedDate}
                disabled={addingBlock}
                className="btn-primary text-xs px-4 py-2.5"
              >
                {addingBlock ? '...' : 'Bloquear fecha'}
              </button>
            </div>

            {/* Blocked dates list */}
            {blockedDates.length === 0 ? (
              <div className="px-6 py-8 text-center text-ink-muted text-sm">
                No hay fechas bloqueadas.
              </div>
            ) : (
              <div className="divide-y divide-beige-dark">
                {blockedDates.map((b) => (
                  <div key={b.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-ink">
                        {new Date(`${b.date}T12:00:00`).toLocaleDateString('es-CO', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                      {b.reason && (
                        <p className="text-xs text-ink-muted mt-0.5">{b.reason}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeBlockedDate(b.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors ml-4"
                    >
                      Desbloquear
                    </button>
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
