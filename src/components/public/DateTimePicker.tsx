'use client'
// src/components/public/DateTimePicker.tsx

import { useState, useEffect } from 'react'
import { format, addDays, isBefore, startOfDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TimeSlot } from '@/types'

interface Props {
  serviceId?:         string
  durationMinutes?:   number
  professionalId?:    string
  selectedDate:       string
  selectedTime:       string
  onDateChange:       (date: string) => void
  onTimeChange:       (time: string) => void
  disabled?:          boolean
}

const DAYS_TO_SHOW = 14

export default function DateTimePicker({
  serviceId, durationMinutes, professionalId, selectedDate, selectedTime,
  onDateChange, onTimeChange, disabled = false,
}: Props) {
  const [slots,   setSlots]   = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Map of dates → has at least one free slot.
  // Filled with a single call to the range endpoint when the component loads.
  // Dates with `false` are shown disabled (not clickable).
  const [dateOpen, setDateOpen] = useState<Record<string, boolean>>({})
  const [rangeLoading, setRangeLoading] = useState(true)

  const availableDates = Array.from({ length: DAYS_TO_SHOW }, (_, i) =>
    format(addDays(new Date(), i), 'yyyy-MM-dd')
  )

  // Build availability URL params
  const availParam = (serviceId ? `serviceId=${serviceId}` : `durationMinutes=${durationMinutes}`)
    + (professionalId ? `&professionalId=${professionalId}` : '')

  // ── Prefetch: availability of ALL visible days, single call ──
  useEffect(() => {
    if (!serviceId && !durationMinutes) return
    setRangeLoading(true)
    const from = availableDates[0]
    const to   = availableDates[availableDates.length - 1]
    fetch(`/api/availability/range?from=${from}&to=${to}&${availParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        const next: Record<string, boolean> = {}
        for (const d of json.data.dates) next[d.date] = d.open
        setDateOpen(next)

        // If the currently selected date is closed, jump to the first open day
        if (selectedDate && next[selectedDate] === false) {
          const firstOpen = json.data.dates.find((d: { date: string; open: boolean }) => d.open)
          if (firstOpen) {
            onDateChange(firstOpen.date)
            onTimeChange('')
          }
        }
      })
      .catch(() => { /* silent — the slot fetch will say if something fails */ })
      .finally(() => setRangeLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, durationMinutes, professionalId])

  // ── Detailed fetch of schedules for the selected date ──
  // We don't depend on dateOpen here to avoid a loop (the source of truth
  // for the open/closed status of each day is the range prefetch).
  useEffect(() => {
    if ((!serviceId && !durationMinutes) || !selectedDate) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/availability?date=${selectedDate}&${availParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (!json.success) {
          setError(json.error ?? 'Error al cargar horarios')
          setSlots([])
          return
        }
        const fetchedSlots: TimeSlot[] = json.data.slots
        setSlots(fetchedSlots)
        // If the day ran out of available slots (e.g. someone booked them
        // while this client was browsing), mark it as closed in the strip
        // so it appears disabled instantly.
        const stillHasAvailable = fetchedSlots.some((s) => s.available)
        if (!stillHasAvailable) {
          setDateOpen((prev) => ({ ...prev, [selectedDate]: false }))
        }
        // If the previously chosen time is no longer available, clear it
        if (selectedTime && !fetchedSlots.find((s) => s.startTime === selectedTime && s.available)) {
          onTimeChange('')
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudo conectar. Intenta de nuevo.')
        setSlots([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, durationMinutes, professionalId, selectedDate])

  function formatDateLabel(dateStr: string) {
    const d = new Date(`${dateStr}T12:00:00`)
    return {
      day:     format(d, 'd', { locale: es }),
      weekday: format(d, 'EEE', { locale: es }),
    }
  }

  const availableSlots = slots.filter((s) => s.available)
  const isSelectedDayClosed = !!selectedDate && dateOpen[selectedDate] === false

  return (
    <div className="space-y-6">

      {/* ── Date picker ── */}
      <div>
        <label className="form-label">
          Fecha
          {rangeLoading && (
            <span className="ml-2 text-ink-muted/50 normal-case font-normal tracking-normal">
              Consultando disponibilidad...
            </span>
          )}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {availableDates.map((dateStr) => {
            const { day, weekday } = formatDateLabel(dateStr)
            const isSelected = dateStr === selectedDate
            const isPast     = isBefore(startOfDay(new Date(`${dateStr}T12:00:00`)), startOfDay(new Date()))
            // The day is considered closed only when the range already responded it's not open
            const isClosed   = dateStr in dateOpen && dateOpen[dateStr] === false
            const isDisabled = disabled || isPast || isClosed

            return (
              <button key={dateStr} type="button"
                role="radio" aria-checked={isSelected}
                disabled={isDisabled}
                onClick={() => { onDateChange(dateStr); onTimeChange('') }}
                className={`relative flex flex-col items-center min-w-[52px] py-3 px-2 rounded-xl
                            border text-xs font-medium transition-all duration-150
                            disabled:cursor-not-allowed
                            ${isSelected
                              ? 'bg-gold border-gold text-white'
                              : isClosed
                                ? 'bg-beige/40 border-beige-dark text-ink-muted/30'
                                : 'bg-white border-beige-dark text-ink-muted hover:border-gold hover:text-gold'
                            }`}
                title={isClosed ? 'Sin atención este día' : undefined}
                aria-disabled={isDisabled}
              >
                <span className="uppercase tracking-widest text-[10px]">{weekday}</span>
                <span className={`text-lg font-serif mt-0.5
                  ${isSelected ? 'text-white' : isClosed ? 'text-ink-muted/30' : 'text-ink'}`}>
                  {day}
                </span>

                {/* "Today" label */}
                {isToday(new Date(`${dateStr}T12:00:00`)) && (
                  <span className={`text-[9px] mt-0.5 tracking-wide
                    ${isSelected ? 'text-white/80' : isClosed ? 'text-ink-muted/30' : 'text-gold'}`}>
                    Hoy
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Time picker ── */}
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

        {/* Closed day (should not be selectable, defensive message) */}
        {!loading && !error && isSelectedDayClosed && (
          <p className="text-sm text-ink-muted italic">
            Este día no tenemos atención. Por favor elige otra fecha.
          </p>
        )}

        {!loading && availableSlots.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableSlots.map((slot) => {
              const isSelected = slot.startTime === selectedTime
              return (
                <button key={slot.startTime} type="button"
                  role="radio" aria-checked={isSelected}
                  disabled={disabled}
                  onClick={() => onTimeChange(slot.startTime)}
                  className={`py-3 text-sm rounded-xl border transition-all duration-150 disabled:cursor-not-allowed
                    ${isSelected
                      ? 'bg-gold border-gold text-white font-semibold'
                      : 'bg-white border-beige-dark text-ink-muted hover:border-gold hover:text-gold'}`}>
                  {slot.startTime}
                </button>
              )
            })}
          </div>
        )}

        {/* Open day but all time slots are taken */}
        {!loading && !error && !isSelectedDayClosed && slots.length > 0 && availableSlots.length === 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-500">
            <span>⚠</span> Todos los horarios de este día están ocupados. Por favor elige otra fecha.
          </div>
        )}
      </div>

    </div>
  )
}
