'use client'
// src/components/public/DateTimePicker.tsx

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, isBefore, startOfDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TimeSlot } from '@/types'

interface Props {
  serviceId:    string
  selectedDate: string
  selectedTime: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  disabled?:    boolean
}

const DAYS_TO_SHOW = 14

export default function DateTimePicker({
  serviceId, selectedDate, selectedTime,
  onDateChange, onTimeChange, disabled = false,
}: Props) {
  const [slots,   setSlots]   = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Mapa de fechas ya consultadas → tiene slots disponibles (true/false)
  // Permite marcar visualmente días sin disponibilidad sin re-fetch
  const [dateAvailability, setDateAvailability] = useState<Record<string, boolean>>({})

  const availableDates = Array.from({ length: DAYS_TO_SHOW }, (_, i) =>
    format(addDays(new Date(), i), 'yyyy-MM-dd')
  )

  const fetchSlots = useCallback(async () => {
    if (!serviceId || !selectedDate) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/availability?date=${selectedDate}&serviceId=${serviceId}`)
      const json = await res.json()
      if (!json.success) {
        setError(json.error ?? 'Error al cargar horarios')
        setSlots([])
        // Marcar esta fecha como sin disponibilidad
        setDateAvailability((prev) => ({ ...prev, [selectedDate]: false }))
        return
      }
      const fetchedSlots: TimeSlot[] = json.data.slots
      setSlots(fetchedSlots)

      // Registrar si esta fecha tiene al menos un slot libre
      const hasAvailable = fetchedSlots.some((s) => s.available)
      setDateAvailability((prev) => ({ ...prev, [selectedDate]: hasAvailable }))

      // Limpiar hora seleccionada si ya no está disponible
      if (selectedTime && !fetchedSlots.find((s) => s.startTime === selectedTime && s.available)) {
        onTimeChange('')
      }
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [serviceId, selectedDate])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  function formatDateLabel(dateStr: string) {
    const d = new Date(`${dateStr}T12:00:00`)
    return {
      day:     format(d, 'd', { locale: es }),
      weekday: format(d, 'EEE', { locale: es }),
    }
  }

  const availableSlots = slots.filter((s) => s.available)

  return (
    <div className="space-y-6">

      {/* ── Selector de fecha ── */}
      <div>
        <label className="form-label">Fecha</label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {availableDates.map((dateStr) => {
            const { day, weekday } = formatDateLabel(dateStr)
            const isSelected  = dateStr === selectedDate
            const isPast      = isBefore(startOfDay(new Date(`${dateStr}T12:00:00`)), startOfDay(new Date()))
            const isChecked   = dateStr in dateAvailability
            const hasNoSlots  = isChecked && !dateAvailability[dateStr]

            return (
              <button key={dateStr} type="button"
                disabled={disabled || isPast}
                onClick={() => { onDateChange(dateStr); onTimeChange('') }}
                className={`relative flex flex-col items-center min-w-[52px] py-3 px-2
                            border text-xs font-medium transition-all duration-150
                            disabled:opacity-30 disabled:cursor-not-allowed
                            ${isSelected
                              ? 'bg-gold border-gold text-white'
                              : hasNoSlots
                                ? 'bg-white border-beige-dark text-ink-muted/40 cursor-pointer'
                                : 'bg-white border-beige-dark text-ink-muted hover:border-gold hover:text-gold'
                            }`}
                title={hasNoSlots ? 'Sin disponibilidad para este día' : undefined}
              >
                <span className="uppercase tracking-widest text-[10px]">{weekday}</span>
                <span className={`text-lg font-serif mt-0.5
                  ${isSelected ? 'text-white' : hasNoSlots ? 'text-ink-muted/40' : 'text-ink'}`}>
                  {day}
                </span>

                {/* "Hoy" label */}
                {isToday(new Date(`${dateStr}T12:00:00`)) && (
                  <span className={`text-[9px] mt-0.5 tracking-wide
                    ${isSelected ? 'text-white/80' : 'text-gold'}`}>
                    Hoy
                  </span>
                )}

                {/* Punto rojo: sin disponibilidad (ya consultado) */}
                {hasNoSlots && !isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-300" />
                )}
              </button>
            )
          })}
        </div>

        {/* Leyenda */}
        <p className="flex items-center gap-1.5 text-xs text-ink-muted/60 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-300 inline-block" />
          Sin disponibilidad
        </p>
      </div>

      {/* ── Selector de hora ── */}
      <div>
        <label className="form-label">
          Hora disponible
          {loading && (
            <span className="ml-2 text-ink-muted/50 normal-case font-normal tracking-normal">
              Cargando...
            </span>
          )}
        </label>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        {!loading && !error && slots.length === 0 && selectedDate && (
          <p className="text-sm text-ink-muted italic">
            No hay horarios disponibles para este día.
          </p>
        )}

        {!loading && availableSlots.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableSlots.map((slot) => {
              const isSelected = slot.startTime === selectedTime
              return (
                <button key={slot.startTime} type="button"
                  disabled={disabled}
                  onClick={() => onTimeChange(slot.startTime)}
                  className={`py-2.5 text-sm border transition-all duration-150 disabled:cursor-not-allowed
                    ${isSelected
                      ? 'bg-gold border-gold text-white font-medium'
                      : 'bg-white border-beige-dark text-ink-muted hover:border-gold hover:text-gold'}`}>
                  {slot.startTime}
                </button>
              )
            })}
          </div>
        )}

        {!loading && !error && slots.length > 0 && availableSlots.length === 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-500">
            <span>⚠</span> Todos los horarios de este día están ocupados. Por favor elige otra fecha.
          </div>
        )}
      </div>

    </div>
  )
}
