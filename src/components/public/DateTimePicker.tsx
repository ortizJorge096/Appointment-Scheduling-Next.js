'use client'
// src/components/public/DateTimePicker.tsx
// Monthly calendar date picker + time-slot list.
// Availability is server-driven: a single /range prefetch per visible month
// fills `dateOpen` (open/closed per day); the API and business rules
// (sundays, blocked dates, capacity) are unchanged.

import { useState, useEffect } from 'react'
import {
  format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isBefore, isAfter, startOfDay,
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { STUDIO } from '@/lib/config'
import WhatsAppLink from './WhatsAppLink'
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
  /** Booking horizon — how many days ahead can be booked. From BookingSettings. */
  maxAdvanceDays?:    number
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function DateTimePicker({
  serviceId, durationMinutes, professionalId, selectedDate, selectedTime,
  onDateChange, onTimeChange, disabled = false, maxAdvanceDays = 90,
}: Props) {
  // Clamp defensively to the same bounds the admin setting enforces (7–365).
  const daysToShow = Math.min(365, Math.max(7, maxAdvanceDays))

  const [slots,   setSlots]   = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Map of dates → has at least one free slot. Filled per visible month from
  // the /range endpoint. A date with `false` is shown disabled (not clickable).
  const [dateOpen, setDateOpen] = useState<Record<string, boolean>>({})
  const [rangeLoading, setRangeLoading] = useState(true)
  // Auto-pick: on load, find and select the first day that has availability.
  const [autoPicking, setAutoPicking] = useState(true)
  const [noUpcoming, setNoUpcoming]   = useState(false)

  // Booking window — "today" anchored to the studio's timezone (Bogotá), not the
  // visitor's browser, so the calendar is consistent for clients in any timezone.
  const todayStr   = formatInTimeZone(new Date(), STUDIO.timezone, 'yyyy-MM-dd')
  const today      = startOfDay(new Date(`${todayStr}T00:00:00`))
  const horizonEnd = addDays(today, daysToShow - 1)

  // Currently displayed month (first day). Starts on the selected date's month.
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date())
  )

  // Calendar grid: full weeks covering the month (Sunday-first).
  const monthStart = startOfMonth(viewMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd    = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 })
  const gridDays   = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Month navigation bounds
  const canPrev = monthStart > startOfMonth(today)
  const canNext = startOfMonth(addMonths(viewMonth, 1)) <= horizonEnd
  const monthKey = format(viewMonth, 'yyyy-MM')

  const availParam = (serviceId ? `serviceId=${serviceId}` : `durationMinutes=${durationMinutes}`)
    + (professionalId ? `&professionalId=${professionalId}` : '')

  // ── Prefetch availability for the visible month (one call) ──
  useEffect(() => {
    if (!serviceId && !durationMinutes) return

    // Only query the bookable slice of the visible grid (today..horizon).
    const from = gridStart < today ? today : gridStart
    const to   = gridEnd > horizonEnd ? horizonEnd : gridEnd
    if (from > to) { setDateOpen({}); setRangeLoading(false); return }

    setRangeLoading(true)
    const fromStr = format(from, 'yyyy-MM-dd')
    const toStr   = format(to, 'yyyy-MM-dd')
    fetch(`/api/availability/range?from=${fromStr}&to=${toStr}&${availParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        const next: Record<string, boolean> = {}
        for (const d of json.data.dates) next[d.date] = d.open
        setDateOpen(next)
      })
      .catch(() => { /* silent — the slot fetch will surface failures */ })
      .finally(() => setRangeLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, durationMinutes, professionalId, daysToShow, monthKey])

  // ── Detailed fetch of slots for the selected date (unchanged behavior) ──
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
        // If the day ran out of slots while browsing, mark it closed instantly.
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

  // ── Auto-pick the first day with availability on load ──
  // One /range call over a 30-day window finds the next open day and selects it,
  // so the user lands on real slots instead of a closed "today". Keyed on the
  // service/professional context — it does NOT depend on selectedDate, so a
  // manual date selection is never overridden.
  useEffect(() => {
    if (!serviceId && !durationMinutes) { setAutoPicking(false); return }
    let cancelled = false
    setAutoPicking(true)
    setNoUpcoming(false)
    const searchDays = Math.min(30, daysToShow)
    const from = format(today, 'yyyy-MM-dd')
    const to   = format(addDays(today, searchDays - 1), 'yyyy-MM-dd')
    fetch(`/api/availability/range?from=${from}&to=${to}&${availParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return
        const firstOpen = json.data.dates.find((d: { date: string; open: boolean }) => d.open)
        if (firstOpen) {
          // If today is open it IS the first → selecting it is a no-op.
          onDateChange(firstOpen.date)
          onTimeChange('')
          setViewMonth(startOfMonth(new Date(`${firstOpen.date}T12:00:00`)))
        } else {
          setNoUpcoming(true)
        }
      })
      .catch(() => { /* fall back to manual navigation */ })
      .finally(() => { if (!cancelled) setAutoPicking(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, durationMinutes, professionalId])

  function changeMonth(delta: 1 | -1) {
    if (delta === -1 && !canPrev) return
    if (delta === 1 && !canNext) return
    setViewMonth((m) => addMonths(m, delta))
    onTimeChange('') // clear the chosen hour when navigating months
  }

  const availableSlots = slots.filter((s) => s.available)
  const isSelectedDayClosed = !!selectedDate && dateOpen[selectedDate] === false

  const monthLabelRaw = format(viewMonth, 'LLLL yyyy', { locale: es })
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1)

  return (
    <div className="space-y-6">

      {/* ── Calendar ── */}
      <div>
        <label className="form-label">
          Fecha
          {rangeLoading && (
            <span className="ml-2 text-ink-muted/50 normal-case font-normal tracking-normal">
              Consultando disponibilidad...
            </span>
          )}
        </label>

        <div className="w-full bg-white border border-beige-dark rounded-[18px] p-5 shadow-sm">
          {/* Header: month nav (44×44 touch targets, chevron icons) */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => changeMonth(-1)} disabled={!canPrev || disabled}
              aria-label="Mes anterior"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted
                         hover:text-gold-deep hover:bg-beige/60 transition-colors
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <p className="font-serif text-lg text-ink capitalize">{monthLabel}</p>
            <button type="button" onClick={() => changeMonth(1)} disabled={!canNext || disabled}
              aria-label="Mes siguiente"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-ink-muted
                         hover:text-gold-deep hover:bg-beige/60 transition-colors
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-2xs tracking-widest uppercase text-gold-deep py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Day cells — all the same size; only the style changes per state */}
          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((day) => {
              const dayStr      = format(day, 'yyyy-MM-dd')
              const inMonth     = isSameMonth(day, viewMonth)
              const past        = isBefore(day, today)
              const beyond      = isAfter(day, horizonEnd)
              const closed      = dateOpen[dayStr] === false
              const isSelected  = dayStr === selectedDate && inMonth
              const isTodayCell = dayStr === todayStr
              const selectable  = inMonth && !past && !beyond && !closed && !disabled

              // Precedence: other-month → selected → today (ring always) →
              // available → in-month disabled (past = default cursor, closed/
              // beyond = not-allowed). Paleta: dorado #b8935a / crema / negro.
              let cls: string
              if (!inMonth) {
                cls = 'text-ink-muted/25 cursor-default'
              } else if (isSelected) {
                cls = 'bg-gold text-ink font-medium'
              } else if (isTodayCell) {
                cls = `border border-gold text-gold-deep font-medium ${
                  selectable ? 'bg-white hover:bg-gold-pale cursor-pointer' : 'cursor-not-allowed'
                }`
              } else if (selectable) {
                cls = 'bg-white border border-beige-dark text-ink hover:bg-beige hover:border-gold hover:text-gold-deep cursor-pointer'
              } else {
                cls = `text-ink-muted/30 ${past ? 'cursor-default' : 'cursor-not-allowed'}`
              }

              return (
                <button
                  key={dayStr}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
                  disabled={!selectable}
                  onClick={() => { if (selectable) { onDateChange(dayStr); onTimeChange('') } }}
                  title={inMonth && closed && !past ? 'Sin disponibilidad este día' : undefined}
                  className={`aspect-square flex items-center justify-center rounded-[10px]
                              text-sm transition-colors duration-150 ${cls}`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Time picker ── */}
      <div>
        <label className="form-label">
          Hora disponible
          {(loading || autoPicking) && (
            <span className="ml-2 text-ink-muted/50 normal-case font-normal tracking-normal">
              {autoPicking ? 'Buscando disponibilidad...' : 'Cargando...'}
            </span>
          )}
        </label>

        {error && !autoPicking && <p className="text-sm text-red-700 mb-3">{error}</p>}

        {/* No availability in the next 30 days → friendly WhatsApp message */}
        {!autoPicking && !loading && noUpcoming && (
          <div className="bg-beige/40 border border-beige-dark rounded-xl px-4 py-4 text-sm text-ink-muted">
            En este momento no tenemos disponibilidad próxima.{' '}
            <WhatsAppLink className="text-gold-deep hover:underline font-medium">
              Escríbenos por WhatsApp
            </WhatsAppLink>{' '}y te ayudamos.
          </div>
        )}

        {/* Manually picked a closed day (auto-pick didn't choose it) */}
        {!autoPicking && !loading && !error && !noUpcoming && isSelectedDayClosed && (
          <p className="text-sm text-ink-muted italic">
            Este día no tenemos atención. Por favor elige otra fecha.
          </p>
        )}

        {!loading && !autoPicking && availableSlots.length > 0 && (
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
                      ? 'bg-gold border-gold text-ink font-semibold'
                      : 'bg-white border-beige-dark text-ink-muted hover:border-gold hover:text-gold-deep'}`}>
                  {slot.startTime}
                </button>
              )
            })}
          </div>
        )}

        {/* Open day but all time slots are taken */}
        {!loading && !autoPicking && !error && !noUpcoming && !isSelectedDayClosed && slots.length > 0 && availableSlots.length === 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            <span>⚠</span> Todos los horarios de este día están ocupados. Por favor elige otra fecha.
          </div>
        )}
      </div>

    </div>
  )
}
