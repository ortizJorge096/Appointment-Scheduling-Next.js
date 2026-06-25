// src/lib/bookingSettings.ts
// Booking flow toggles — parametrized via DB (BookingSettings, singleton).
// Currently: whether /agendar shows the professional-selection step.

import { prisma } from '@/lib/prisma'

export interface BookingSettingsData {
  showProfessionalStep: boolean
  maxAdvanceDays: number
}

const DEFAULTS: BookingSettingsData = { showProfessionalStep: true, maxAdvanceDays: 90 }

/** Reads the current booking settings from the DB (sane defaults if missing or
 *  unreachable — never throws, so SSR pages that read it can't 500 on a DB blip). */
export async function getBookingSettings(): Promise<BookingSettingsData> {
  try {
    const config = await prisma.bookingSettings.findFirst()
    return {
      showProfessionalStep: config?.showProfessionalStep ?? DEFAULTS.showProfessionalStep,
      maxAdvanceDays:       config?.maxAdvanceDays ?? DEFAULTS.maxAdvanceDays,
    }
  } catch {
    return DEFAULTS
  }
}
