// src/app/api/availability/route.ts
// GET /api/availability?date=YYYY-MM-DD&serviceId=xxx
// Returns available slots for a date and service

import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/availability'
import { availabilityQuerySchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import type { ApiResponse, AvailabilityResponse } from '@/types'

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<AvailabilityResponse>>> {
  try {
    const { searchParams } = new URL(request.url)
    const params = {
      date: searchParams.get('date') ?? '',
      serviceId: searchParams.get('serviceId') ?? '',
    }

    // Validate parameters
    const parsed = availabilityQuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { date, serviceId } = parsed.data
    const { slots, durationMinutes } = await getAvailableSlots(date, serviceId)

    return NextResponse.json({
      success: true,
      data: { date, slots, serviceDuration: durationMinutes },
    })
  } catch (error) {
    if (isDbUnavailable(error)) return dbUnavailableResponse()
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
