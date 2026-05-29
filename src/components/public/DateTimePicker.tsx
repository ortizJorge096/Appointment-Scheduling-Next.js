'use client'
// src/components/public/DateTimePicker.tsx

import { useState, useEffect } from 'react'
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

  // Mapa de fechas → tiene al menos un horario libre.
  // Se llena con una sola llamada al endpoint de rango al cargar el componente.
  // Las fechas con `false` se muestran deshabilitadas (no clickables).
  const [dateOpen, setDateOpen] = useState<Record<string, boolean>>({})
  const [rangeLoading, setRangeLoading] = useState(true)

  const availableDates = Array.from({ length: DAYS_TO_SHOW }, (_, i) =>
    format(addDays(new Date(), i), 'yyyy-MM-dd')
  )

  // ── Prefetch: disponibilidad de TODOS los días visibles, una sola llamada ──
  useEffect(() => {
    if (!serviceId) return
    setRangeLoading(true)
    const from = availableDates[0]
    const to   = availableDates[availableDates.length - 1]
    fetch(`/api/availability/range?from=${from}&to=${to}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        const next: Record<string, boolean> = {}
        for (const d of json.data.dates) next[d.date] = d.open
        setDateOpen(next)

        // Si la fecha actualmente elegida quedó cerrada, saltar al primer día abierto
        if (selectedDate && next[selectedDate] === false) {
          const firstOpen = json.data.dates.find((d: { date: string; open: boolean }) => d.open)
          if (firstOpen) {
            onDateChange(firstOpen.date)
            onTimeChange('')
          }
        }
      })
      .catch(() => { /* silencioso — el slot fetch dirá si algo falla */ })
      .finally(() => setRangeLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  // ── Fetch detallado de horarios para la fecha seleccionada ──
  // No dependemos de dateOpen aquí para evitar un bucle (la fuente de verdad
  // del estado abierto/cerrado de cada día es el prefetch de rango).
  useEffect(() => {
    if (!serviceId || !selectedDate) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/availability?date=${selectedDate}&serviceId=${serviceId}`)
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
        // Si el día se quedó sin huecos disponibles (p.ej. lo llenaron
        // mientras esta clienta navegaba), marcarlo como cerrado en la tira
        // para que aparezca deshabilitado al instante.
        const stillHasAvailable = fetchedSlots.some((s) => s.available)
        if (!stillHasAvailable) {
          setDateOpen((prev) => ({ ...prev, [selectedDate]: false }))
        }
        // Si la hora previamente elegida ya no está disponible, limpiarla
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
  }, [serviceId, selectedDate])

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

      {/* ── Selector de fecha ── */}
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
            // El día se considera cerrado solo cuando el rango ya respondió que no está abierto
            const isClosed   = dateStr in dateOpen && dateOpen[dateStr] === false
            const isDisabled = disabled || isPast || isClosed

            return (
              <button key={dateStr} type="button"
                disabled={isDisabled}
                onClick={() => { onDateChange(dateStr); onTimeChange('') }}
                className={`relative flex flex-col items-center min-w-[52px] py-3 px-2
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

                {/* "Hoy" label */}
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

        {/* Día cerrado (no debería ser seleccionable, mensaje defensivo) */}
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

        {/* Día abierto pero todos los horarios ocupados */}
        {!loading && !error && !isSelectedDayClosed && slots.length > 0 && availableSlots.length === 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-500">
            <span>⚠</span> Todos los horarios de este día están ocupados. Por favor elige otra fecha.
          </div>
        )}
      </div>

    </div>
  )
}
