// src/lib/cancellation.ts
// Single source of truth for the client-facing cancellation window.
// Used by the public appointment GET (to gate the UI) and by the cancel POST
// (to enforce it). Times are interpreted in the studio's timezone.

import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { STUDIO } from './config'

// Appointments can only be cancelled online at least this many hours ahead.
export const CANCEL_LIMIT_HOURS = 24

// Hours from now until the appointment start. appointment.date is stored in UTC;
// startTime is the local "HH:mm" in the studio timezone, so we rebuild the real
// UTC instant of the appointment start before comparing.
export function hoursUntilAppointment(date: Date | string, startTime: string): number {
  const dateStr = format(toZonedTime(new Date(date), STUDIO.timezone), 'yyyy-MM-dd')
  const appointmentAt = fromZonedTime(`${dateStr}T${startTime}:00`, STUDIO.timezone)
  return (appointmentAt.getTime() - Date.now()) / (1000 * 60 * 60)
}

// Whether the appointment is still within the online-cancellation window.
export function isWithinCancelWindow(date: Date | string, startTime: string): boolean {
  return hoursUntilAppointment(date, startTime) >= CANCEL_LIMIT_HOURS
}
