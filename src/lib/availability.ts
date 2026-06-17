// src/lib/availability.ts
// Availability logic — generates and validates time slots
// valentinajimenez

import { prisma } from './prisma'
import { STUDIO } from './config'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import type { TimeSlot } from '@/types'
import type { DayOfWeek } from '@prisma/client'

// ─────────────────────────────────────────
// TIME HELPERS
// ─────────────────────────────────────────

/**
 * Day of week (0=Sunday … 6=Saturday) for a "YYYY-MM-DD" date.
 * Independent of the server timezone.
 */
function weekdayFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * Converts "HH:MM" to minutes since midnight.
 * E.g.: "09:30" → 570
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Converts minutes since midnight to "HH:MM".
 * E.g.: 570 → "09:30"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Maps the JS day number (0-6, Sunday=0) to the Prisma DayOfWeek enum.
 */
function jsDayToDayOfWeek(day: number): string {
  const map: Record<number, string> = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
  }
  return map[day]
}

/**
 * Checks whether two time ranges overlap.
 * All values are in minutes since midnight.
 */
function timesOverlap(
  startA: number, endA: number,
  startB: number, endB: number
): boolean {
  return startA < endB && endA > startB
}

// ─────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────

/**
 * Generates every available slot for a given date and service.
 *
 * Flow:
 * 1. Verify the date is not blocked
 * 2. Get the weekday's schedule
 * 3. Generate slots every [durationMinutes] within the schedule
 * 4. Drop slots that overlap with existing appointments
 * 5. Drop slots in the past
 *
 * @param dateStr  Date in "YYYY-MM-DD" format
 * @param serviceId  Service ID (used to get its duration)
 * @returns List of slots with availability
 */
export async function getAvailableSlots(
  dateStr: string,
  serviceId: string
): Promise<{ slots: TimeSlot[]; durationMinutes: number }> {

  // 1. Load service
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { durationMinutes: true, name: true },
  })

  if (!service) {
    throw new Error('Servicio no encontrado o inactivo')
  }

  const { durationMinutes } = service

  // 2. Compute "today" in the business timezone and drop past dates
  const nowBogota = toZonedTime(new Date(), STUDIO.timezone)
  const todayStr  = format(nowBogota, 'yyyy-MM-dd')

  if (dateStr < todayStr) {
    return { slots: [], durationMinutes }
  }

  // 3. Verify the date is not blocked
  const blocked = await prisma.blockedDate.findFirst({
    where: {
      date: {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59`),
      },
    },
  })

  if (blocked) {
    return { slots: [], durationMinutes }
  }

  // 4. Get the weekday's schedule
  const dayOfWeek = jsDayToDayOfWeek(weekdayFromDateStr(dateStr))
  const schedule = await prisma.schedule.findUnique({
    where: { dayOfWeek: dayOfWeek as DayOfWeek },
  })

  if (!schedule || !schedule.isActive) {
    return { slots: [], durationMinutes }
  }

  // 5. Load already confirmed/pending appointments for that date
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59`),
      },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { startTime: true, endTime: true },
  })

  // 6. Generate slots every [slotGranularityMin] within the schedule
  const scheduleStart = timeToMinutes(schedule.startTime)
  const scheduleEnd = timeToMinutes(schedule.endTime)
  const step = STUDIO.slotGranularityMin
  const slots: TimeSlot[] = []

  // Current time in minutes, in the business timezone (so we don't offer past slots today)
  const isToday = dateStr === todayStr
  const currentMinutes = isToday
    ? nowBogota.getHours() * 60 + nowBogota.getMinutes() + STUDIO.bookingBufferMin
    : 0

  for (
    let slotStart = scheduleStart;
    slotStart + durationMinutes <= scheduleEnd;
    slotStart += step
  ) {
    const slotEnd = slotStart + durationMinutes
    const startTimeStr = minutesToTime(slotStart)
    const endTimeStr = minutesToTime(slotEnd)

    // Drop past slots (when it's today)
    if (slotStart < currentMinutes) {
      continue
    }

    // Check overlap with existing appointments
    const hasConflict = existingAppointments.some((appt) => {
      const apptStart = timeToMinutes(appt.startTime)
      const apptEnd = timeToMinutes(appt.endTime)
      return timesOverlap(slotStart, slotEnd, apptStart, apptEnd)
    })

    slots.push({
      startTime: startTimeStr,
      endTime: endTimeStr,
      available: !hasConflict,
    })
  }

  return { slots, durationMinutes }
}

/**
 * Checks whether a specific slot is still available.
 * Used right before confirming an appointment to avoid race conditions.
 */
export async function isSlotAvailable(
  dateStr: string,
  startTime: string,
  serviceId: string
): Promise<boolean> {
  const { slots } = await getAvailableSlots(dateStr, serviceId)
  const slot = slots.find((s) => s.startTime === startTime)
  return slot?.available ?? false
}

/**
 * Generates every available slot for a given date and duration.
 * Used for multi-service bookings where we know the total duration.
 *
 * @param dateStr  Date in "YYYY-MM-DD" format
 * @param durationMinutes  Total duration of all selected services
 * @returns List of slots with availability
 */
export async function getAvailableSlotsByDuration(
  dateStr: string,
  durationMinutes: number
): Promise<{ slots: TimeSlot[]; durationMinutes: number }> {

  // 1. Compute "today" in the business timezone and drop past dates
  const nowBogota = toZonedTime(new Date(), STUDIO.timezone)
  const todayStr  = format(nowBogota, 'yyyy-MM-dd')

  if (dateStr < todayStr) {
    return { slots: [], durationMinutes }
  }

  // 2. Verify the date is not blocked
  const blocked = await prisma.blockedDate.findFirst({
    where: {
      date: {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59`),
      },
    },
  })

  if (blocked) {
    return { slots: [], durationMinutes }
  }

  // 3. Get the weekday's schedule
  const dayOfWeek = jsDayToDayOfWeek(weekdayFromDateStr(dateStr))
  const schedule = await prisma.schedule.findUnique({
    where: { dayOfWeek: dayOfWeek as DayOfWeek },
  })

  if (!schedule || !schedule.isActive) {
    return { slots: [], durationMinutes }
  }

  // 4. Load already confirmed/pending appointments for that date
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      date: {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59`),
      },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { startTime: true, endTime: true },
  })

  // 5. Generate slots every [slotGranularityMin] within the schedule
  const scheduleStart = timeToMinutes(schedule.startTime)
  const scheduleEnd = timeToMinutes(schedule.endTime)
  const step = STUDIO.slotGranularityMin
  const slots: TimeSlot[] = []

  // Current time in minutes, in the business timezone (so we don't offer past slots today)
  const isToday = dateStr === todayStr
  const currentMinutes = isToday
    ? nowBogota.getHours() * 60 + nowBogota.getMinutes() + STUDIO.bookingBufferMin
    : 0

  for (
    let slotStart = scheduleStart;
    slotStart + durationMinutes <= scheduleEnd;
    slotStart += step
  ) {
    const slotEnd = slotStart + durationMinutes
    const startTimeStr = minutesToTime(slotStart)
    const endTimeStr = minutesToTime(slotEnd)

    // Drop past slots (when it's today)
    if (slotStart < currentMinutes) {
      continue
    }

    // Check overlap with existing appointments
    const hasConflict = existingAppointments.some((appt) => {
      const apptStart = timeToMinutes(appt.startTime)
      const apptEnd = timeToMinutes(appt.endTime)
      return timesOverlap(slotStart, slotEnd, apptStart, apptEnd)
    })

    slots.push({
      startTime: startTimeStr,
      endTime: endTimeStr,
      available: !hasConflict,
    })
  }

  return { slots, durationMinutes }
}
