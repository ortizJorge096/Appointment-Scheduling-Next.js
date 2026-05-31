// src/app/api/availability/range/route.ts
// GET /api/availability/range?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=xxx
// Devuelve, para cada día del rango, si tiene al menos un horario libre.
// Una sola consulta en lugar de N llamadas a /api/availability.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { timeToMinutes } from '@/lib/availability'
import { addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

const MAX_RANGE_DAYS = 60

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
    const serviceId = searchParams.get('serviceId') ?? ''

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ success: false, error: 'Fechas inválidas' }, { status: 400 })
    }
    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Servicio requerido' }, { status: 400 })
    }
    if (from > to) {
      return NextResponse.json({ success: false, error: 'Rango inválido' }, { status: 400 })
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId, isActive: true },
      select: { durationMinutes: true },
    })
    if (!service) {
      return NextResponse.json({ success: false, error: 'Servicio no disponible' }, { status: 404 })
    }

    // Construir lista de fechas del rango (cap a 60 días)
    const dates: string[] = []
    let cursor = new Date(`${from}T12:00:00`)
    const end = new Date(`${to}T12:00:00`)
    while (cursor <= end && dates.length < MAX_RANGE_DAYS) {
      dates.push(format(cursor, 'yyyy-MM-dd'))
      cursor = addDays(cursor, 1)
    }

    // Cargar de una vez: horarios semanales, fechas bloqueadas y citas activas del rango.
    const rangeStart = new Date(`${from}T00:00:00`)
    const rangeEnd   = new Date(`${to}T23:59:59`)

    const [schedules, blocked, appointments] = await Promise.all([
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
        select: { date: true, startTime: true, endTime: true },
      }),
    ])

    const scheduleByDay = new Map(schedules.map((s) => [s.dayOfWeek, s]))
    const blockedSet = new Set(blocked.map((b) => format(b.date, 'yyyy-MM-dd')))

    // Agrupar citas por día (YYYY-MM-DD)
    const apptsByDay = new Map<string, { startTime: string; endTime: string }[]>()
    for (const a of appointments) {
      const key = format(a.date, 'yyyy-MM-dd')
      const arr = apptsByDay.get(key) ?? []
      arr.push({ startTime: a.startTime, endTime: a.endTime })
      apptsByDay.set(key, arr)
    }

    // "Ahora" en zona horaria del negocio
    const nowBogota = toZonedTime(new Date(), STUDIO.timezone)
    const todayStr  = format(nowBogota, 'yyyy-MM-dd')
    const nowMinutes = nowBogota.getHours() * 60 + nowBogota.getMinutes() + STUDIO.bookingBufferMin

    const duration = service.durationMinutes
    const step     = STUDIO.slotGranularityMin

    const result: DayAvailability[] = dates.map((dateStr) => {
      // Pasado
      if (dateStr < todayStr) return { date: dateStr, open: false }
      // Bloqueado
      if (blockedSet.has(dateStr)) return { date: dateStr, open: false }
      // Día de la semana cerrado
      const wd = weekdayFromDateStr(dateStr)
      const schedule = scheduleByDay.get(DAYS_OF_WEEK[wd as 0 | 1 | 2 | 3 | 4 | 5 | 6])
      if (!schedule || !schedule.isActive) return { date: dateStr, open: false }

      const scheduleStart = timeToMinutes(schedule.startTime)
      const scheduleEnd   = timeToMinutes(schedule.endTime)
      const minStart = dateStr === todayStr ? nowMinutes : 0

      const appts = apptsByDay.get(dateStr) ?? []
      const apptRanges = appts.map((a) => ({
        s: timeToMinutes(a.startTime),
        e: timeToMinutes(a.endTime),
      }))

      // ¿Existe al menos un slot libre?
      for (let s = scheduleStart; s + duration <= scheduleEnd; s += step) {
        if (s < minStart) continue
        const e = s + duration
        const overlaps = apptRanges.some((r) => s < r.e && e > r.s)
        if (!overlaps) return { date: dateStr, open: true }
      }
      return { date: dateStr, open: false }
    })

    return NextResponse.json({ success: true, data: { dates: result } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
