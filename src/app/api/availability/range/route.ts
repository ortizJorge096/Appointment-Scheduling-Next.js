// src/app/api/availability/range/route.ts
// GET /api/availability/range?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=xxx
// GET /api/availability/range?from=YYYY-MM-DD&to=YYYY-MM-DD&durationMinutes=60
// Returns, for each day in the range, whether it has at least one free slot.
// Single query instead of N calls to /api/availability.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { timeToMinutes } from '@/lib/availability'
import { addDays, format } from 'date-fns'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

// Safety cap on how many days a single range query computes. Must be >= the
// booking horizon (BookingSettings.maxAdvanceDays, max 365) so the date strip
// never has "phantom" days the prefetch didn't resolve.
const MAX_RANGE_DAYS = 365

interface DayAvailability {
  date: string  // YYYY-MM-DD
  open: boolean
}

const DAYS_OF_WEEK = [
  'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
] as const

function weekdayFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    const serviceId = searchParams.get('serviceId') ?? undefined
    const durationMinutesParam = searchParams.get('durationMinutes')
    const professionalId = searchParams.get('professionalId') ?? undefined

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ success: false, error: 'Fechas inválidas' }, { status: 400 })
    }
    if (!serviceId && !durationMinutesParam) {
      return NextResponse.json({ success: false, error: 'Servicio o duración requerido' }, { status: 400 })
    }
    if (from > to) {
      return NextResponse.json({ success: false, error: 'Rango inválido' }, { status: 400 })
    }

    let duration: number
    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId, isActive: true },
        select: { durationMinutes: true },
      })
      if (!service) {
        return NextResponse.json({ success: false, error: 'Servicio no disponible' }, { status: 404 })
      }
      duration = service.durationMinutes
    } else {
      duration = parseInt(durationMinutesParam!, 10)
      if (isNaN(duration) || duration < 15 || duration > 480) {
        return NextResponse.json({ success: false, error: 'Duración inválida' }, { status: 400 })
      }
    }

    // Build list of dates in range (capped at 60 days)
    const dates: string[] = []
    let cursor = new Date(`${from}T12:00:00`)
    const end = new Date(`${to}T12:00:00`)
    while (cursor <= end && dates.length < MAX_RANGE_DAYS) {
      dates.push(format(cursor, 'yyyy-MM-dd'))
      cursor = addDays(cursor, 1)
    }

    // Load at once: weekly schedules, blocked dates, and active appointments in range.
    const rangeStart = new Date(`${from}T00:00:00`)
    const rangeEnd   = new Date(`${to}T23:59:59`)

    const [schedules, blocked, appointments, professionalCount] = await Promise.all([
      prisma.schedule.findMany({}),
      prisma.blockedDate.findMany({
        where: { date: { gte: rangeStart, lte: rangeEnd } },
        select: { date: true },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: rangeStart, lte: rangeEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: { date: true, startTime: true, endTime: true, professionalId: true },
      }),
      prisma.professional.count({ where: { isActive: true } }),
    ])

    // Capacity = number of active professionals (falls back to 1 — legacy
    // single-resource behavior — if none have been set up yet).
    const capacity = professionalCount > 0 ? professionalCount : 1

    const scheduleByDay = new Map(schedules.map((s) => [s.dayOfWeek, s]))
    // blocked/appointment dates are "date-only": compare them as a UTC calendar day
    // so the result is deterministic and independent of the runtime timezone
    // (server or CI runner). Matches the calendar day used to build the range.
    const blockedSet = new Set(blocked.map((b) => formatInTimeZone(b.date, 'UTC', 'yyyy-MM-dd')))

    // Group appointments by day (YYYY-MM-DD)
    const apptsByDay = new Map<string, { startTime: string; endTime: string; professionalId: string | null }[]>()
    for (const a of appointments) {
      const key = formatInTimeZone(a.date, 'UTC', 'yyyy-MM-dd')
      const arr = apptsByDay.get(key) ?? []
      arr.push({ startTime: a.startTime, endTime: a.endTime, professionalId: a.professionalId })
      apptsByDay.set(key, arr)
    }

    // "Now" in business timezone
    const nowBogota = toZonedTime(new Date(), STUDIO.timezone)
    const todayStr  = format(nowBogota, 'yyyy-MM-dd')
    const nowMinutes = nowBogota.getHours() * 60 + nowBogota.getMinutes() + STUDIO.bookingBufferMin

    const step     = STUDIO.slotGranularityMin

    const result: DayAvailability[] = dates.map((dateStr) => {
      // Past
      if (dateStr < todayStr) return { date: dateStr, open: false }
      // Blocked
      if (blockedSet.has(dateStr)) return { date: dateStr, open: false }
      // Day of week closed
      const wd = weekdayFromDateStr(dateStr)
      const schedule = scheduleByDay.get(DAYS_OF_WEEK[wd as 0 | 1 | 2 | 3 | 4 | 5 | 6])
      if (!schedule || !schedule.isActive) return { date: dateStr, open: false }

      const scheduleStart = timeToMinutes(schedule.startTime)
      const scheduleEnd   = timeToMinutes(schedule.endTime)
      const minStart = dateStr === todayStr ? nowMinutes : 0

      const appts = apptsByDay.get(dateStr) ?? []
      const relevant = professionalId ? appts.filter((a) => a.professionalId === professionalId) : appts
      const apptRanges = relevant.map((a) => ({
        s: timeToMinutes(a.startTime),
        e: timeToMinutes(a.endTime),
      }))

      // Is there at least one free slot? Without a specific professional, a
      // slot is taken only once overlapping appointments reach total capacity.
      for (let s = scheduleStart; s + duration <= scheduleEnd; s += step) {
        if (s < minStart) continue
        const e = s + duration
        const overlapCount = apptRanges.filter((r) => s < r.e && e > r.s).length
        const taken = professionalId ? overlapCount > 0 : overlapCount >= capacity
        if (!taken) return { date: dateStr, open: true }
      }
      return { date: dateStr, open: false }
    })

    return NextResponse.json({ success: true, data: { dates: result } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
