// src/app/api/availability/today/route.ts
// GET /api/availability/today
// Lightweight endpoint powering the "Quedan X cupos para hoy" scarcity badge.
// Counts remaining bookable slots today across every active professional.

import { NextResponse } from 'next/server'
import { getRemainingSlotsToday } from '@/lib/availability'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const remaining = await getRemainingSlotsToday()
    return NextResponse.json({ success: true, data: { remaining } })
  } catch (error) {
    if (isDbUnavailable(error)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
