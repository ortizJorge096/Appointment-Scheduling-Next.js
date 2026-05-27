'use client'
// src/components/admin/ScheduleEditor.tsx

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

const DAYS = [
  { key: 'MONDAY',    label: 'Lunes'     },
  { key: 'TUESDAY',   label: 'Martes'    },
  { key: 'WEDNESDAY', label: 'Miércoles' },
  { key: 'THURSDAY',  label: 'Jueves'    },
  { key: 'FRIDAY',    label: 'Viernes'   },
  { key: 'SATURDAY',  label: 'Sábado'    },
  { key: 'SUNDAY',    label: 'Domingo'   },
]

export interface ScheduleRow {
  id?:        string
  dayOfWeek:  string
  startTime:  string
  endTime:    string
  isActive:   boolean
}

interface Props {
  schedules:  ScheduleRow[]
  onSave:     (schedule: ScheduleRow) => Promise<boolean>
}

export function ScheduleEditor({ schedules: initial, onSave }: Props) {
  // Estado local que mezcla los datos del servidor con ediciones locales
  const [rows, setRows] = useState<ScheduleRow[]>(() => {
    const map = Object.fromEntries(initial.map((s) => [s.dayOfWeek, s]))
    return DAYS.map((d) =>
      map[d.key] ?? { dayOfWeek: d.key, startTime: '09:00', endTime: '18:00', isActive: false }
    )
  })

  const [saving, setSaving]   = useState<string | null>(null)  // dayOfWeek que se está guardando
  const [saved,  setSaved]    = useState<string | null>(null)  // feedback visual
  const [error,  setError]    = useState<string | null>(null)

  function updateRow(day: string, field: keyof ScheduleRow, value: string | boolean) {
    setRows((prev) => prev.map((r) => r.dayOfWeek === day ? { ...r, [field]: value } : r))
    setError(null)
  }

  async function handleSave(row: ScheduleRow) {
    if (row.startTime >= row.endTime) {
      setError(`${DAYS.find((d) => d.key === row.dayOfWeek)?.label}: la hora de inicio debe ser anterior a la de fin`)
      return
    }
    setSaving(row.dayOfWeek)
    setError(null)
    const ok = await onSave(row)
    if (ok) {
      setSaved(row.dayOfWeek)
      setTimeout(() => setSaved(null), 2000)
    } else {
      setError('Error al guardar. Intenta de nuevo.')
    }
    setSaving(null)
  }

  return (
    <div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="divide-y divide-beige-dark">
        {rows.map((row) => {
          const dayLabel = DAYS.find((d) => d.key === row.dayOfWeek)?.label ?? row.dayOfWeek
          const isSaving = saving === row.dayOfWeek
          const isSaved  = saved  === row.dayOfWeek

          return (
            <div
              key={row.dayOfWeek}
              className={`px-6 py-4 flex flex-wrap items-center gap-4 transition-opacity
                ${row.isActive ? '' : 'opacity-50'}`}
            >
              {/* Toggle activo */}
              <label className="flex items-center gap-2.5 cursor-pointer min-w-[110px]">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(e) => updateRow(row.dayOfWeek, 'isActive', e.target.checked)}
                  className="accent-gold w-4 h-4 cursor-pointer"
                />
                <span className="text-sm font-medium text-ink">{dayLabel}</span>
              </label>

              {/* Rango horario */}
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="time"
                  value={row.startTime}
                  disabled={!row.isActive}
                  onChange={(e) => updateRow(row.dayOfWeek, 'startTime', e.target.value)}
                  className="input-field py-1.5 w-28 text-sm disabled:cursor-not-allowed"
                />
                <span className="text-ink-muted">–</span>
                <input
                  type="time"
                  value={row.endTime}
                  disabled={!row.isActive}
                  onChange={(e) => updateRow(row.dayOfWeek, 'endTime', e.target.value)}
                  className="input-field py-1.5 w-28 text-sm disabled:cursor-not-allowed"
                />
              </div>

              {/* Botón guardar + feedback */}
              <div className="ml-auto flex items-center gap-3">
                {isSaved && (
                  <span className="text-xs text-green-600 animate-fade-in">✓ Guardado</span>
                )}
                <button
                  onClick={() => handleSave(row)}
                  disabled={isSaving}
                  className="text-xs text-gold border border-gold px-3 py-1.5
                             hover:bg-gold hover:text-white transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
