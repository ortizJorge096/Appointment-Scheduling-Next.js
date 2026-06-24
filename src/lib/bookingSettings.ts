// src/lib/bookingSettings.ts
// Booking flow toggles — parametrized via DB (BookingSettings, singleton).
// Currently: whether /agendar shows the professional-selection step.

import { prisma } from '@/lib/prisma'

export interface BookingSettingsData {
  showProfessionalStep: boolean
  maxAdvanceDays: number
}

/** Reads the current booking settings from the DB (sane defaults if missing). */
export async function getBookingSettings(): Promise<BookingSettingsData> {
  const config = await prisma.bookingSettings.findFirst()
  return {
    showProfessionalStep: config?.showProfessionalStep ?? true,
    maxAdvanceDays:       config?.maxAdvanceDays ?? 90,
  }
}
