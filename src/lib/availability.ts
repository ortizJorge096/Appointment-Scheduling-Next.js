// src/lib/availability.ts
// Lógica de disponibilidad — genera y valida slots de tiempo
// valentinajimenez

import { prisma } from './prisma'
import { STUDIO } from './config'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import type { TimeSlot } from '@/types'

// ─────────────────────────────────────────
// HELPERS DE TIEMPO
// ─────────────────────────────────────────

/**
 * Día de la semana (0=domingo … 6=sábado) de una fecha "YYYY-MM-DD".
 * Independiente de la zona horaria del servidor.
 */
function weekdayFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * Convierte "HH:MM" a minutos desde medianoche
 * Ej: "09:30" → 570
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convierte minutos desde medianoche a "HH:MM"
 * Ej: 570 → "09:30"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Mapea el número de día JS (0-6, domingo=0) al enum DayOfWeek de Prisma
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
 * Verifica si dos rangos de tiempo se solapan
 * Todos los valores en minutos desde medianoche
 */
function timesOverlap(
  startA: number, endA: number,
  startB: number, endB: number
): boolean {
  return startA < endB && endA > startB
}

// ─────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────

/**
 * Genera todos los slots disponibles para una fecha y servicio dado.
 *
 * Flujo:
 * 1. Verifica que la fecha no esté bloqueada
 * 2. Obtiene el horario del día de la semana
 * 3. Genera slots cada [durationMinutes] dentro del horario
 * 4. Descarta slots que solapen con citas existentes
 * 5. Descarta slots en el pasado
 *
 * @param dateStr  Fecha en formato "YYYY-MM-DD"
 * @param serviceId  ID del servicio (para obtener duración)
 * @returns Lista de slots con disponibilidad
 */
export async function getAvailableSlots(
  dateStr: string,
  serviceId: string
): Promise<{ slots: TimeSlot[]; durationMinutes: number }> {

  // 1. Cargar servicio
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { durationMinutes: true, name: true },
  })

  if (!service) {
    throw new Error('Servicio no encontrado o inactivo')
  }

  const { durationMinutes } = service

  // 2. Calcular "hoy" en la zona horaria del negocio y descartar fechas pasadas
  const nowBogota = toZonedTime(new Date(), STUDIO.timezone)
  const todayStr  = format(nowBogota, 'yyyy-MM-dd')

  if (dateStr < todayStr) {
    return { slots: [], durationMinutes }
  }

  // 3. Verificar que la fecha no esté bloqueada
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

  // 4. Obtener horario del día de la semana
  const dayOfWeek = jsDayToDayOfWeek(weekdayFromDateStr(dateStr))
  const schedule = await prisma.schedule.findUnique({
    where: { dayOfWeek: dayOfWeek as any },
  })

  if (!schedule || !schedule.isActive) {
    return { slots: [], durationMinutes }
  }

  // 5. Cargar citas ya confirmadas/pendientes para esa fecha
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

  // 6. Generar slots cada [slotGranularityMin] dentro del horario
  const scheduleStart = timeToMinutes(schedule.startTime)
  const scheduleEnd = timeToMinutes(schedule.endTime)
  const step = STUDIO.slotGranularityMin
  const slots: TimeSlot[] = []

  // Hora actual en minutos, en zona horaria del negocio (para no ofrecer slots pasados hoy)
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

    // Descartar slots pasados (si es hoy)
    if (slotStart < currentMinutes) {
      continue
    }

    // Verificar solapamiento con citas existentes
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
 * Verifica si un slot específico sigue disponible.
 * Usado justo antes de confirmar una cita para evitar race conditions.
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
