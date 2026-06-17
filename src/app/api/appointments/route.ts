// src/app/api/appointments/route.ts
// GET  /api/appointments   → list appointments (admin, with filters)
// POST /api/appointments   → create new appointment (public, with rate limit)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAppointmentSchema } from '@/lib/validations'
import { isSlotAvailable, timeToMinutes, minutesToTime } from '@/lib/availability'
import { sendConfirmationEmail } from '@/lib/email'
import { createCalendarEvent } from '@/lib/calendar'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import type { ApiResponse, AppointmentWithService } from '@/types'

// ─────────────────────────────────────────
// Simple in-memory RATE LIMITING
// (use Redis or Upstash in production)
// ─────────────────────────────────────────

// In-memory rate limiter (single-pod k3s). Resets on restart — acceptable for small studio.
// Migrate to Redis/DB if horizontal scaling is needed.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

// Internal error to abort the transaction when the slot is already taken
class SlotTakenError extends Error {}

export const dynamic = 'force-dynamic'

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000  // 1 hour
  const maxRequests = 5             // max 5 appointments per IP per hour

  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false

  entry.count++
  return true
}

// ─────────────────────────────────────────
// GET — list appointments (admin only)
// ─────────────────────────────────────────

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

  const where: Record<string, unknown> = {}

  if (status) where.status = status

  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {}),
    }
  }

  let appointments, total
  try {
    ;[appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          service: {
            select: { id: true, name: true, price: true, durationMinutes: true },
          },
          services: {
            include: {
              service: {
                select: { id: true, name: true, price: true, durationMinutes: true },
              },
            },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ])
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error listando citas:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      appointments,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    },
  })
}

// ─────────────────────────────────────────
// POST — create appointment (public)
// ─────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<AppointmentWithService>>> {
  // Rate limiting by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Demasiados intentos. Inténtalo en 1 hora.' },
      { status: 429 }
    )
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body inválido' },
      { status: 400 }
    )
  }

  const parsed = createAppointmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { clientName, clientEmail, clientPhone, serviceId, serviceIds, totalDurationMinutes, date, startTime, notes } =
    parsed.data

  // For multi-service bookings, verify all services exist
  const allServiceIds = serviceIds && serviceIds.length > 1 ? serviceIds : [serviceId]
  let services
  try {
    services = await prisma.service.findMany({
      where: { id: { in: allServiceIds }, isActive: true },
      select: { id: true, name: true, price: true, durationMinutes: true },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  if (services.length !== allServiceIds.length) {
    return NextResponse.json(
      { success: false, error: 'Uno o más servicios no están disponibles' },
      { status: 404 }
    )
  }

  // Use the primary service for backward compat
  const service = services.find((s) => s.id === serviceId) ?? services[0]

  // Calculate total duration
  const computedDuration = totalDurationMinutes ?? services.reduce((sum, s) => sum + s.durationMinutes, 0)

  // Preliminary check (valid schedule, not in the past, open day, not blocked)
  let available
  try {
    // Use durationMinutes-based check for multi-service bookings
    if (serviceIds && serviceIds.length > 1) {
      const { getAvailableSlotsByDuration } = await import('@/lib/availability')
      const { slots } = await getAvailableSlotsByDuration(date, computedDuration)
      const slot = slots.find((s) => s.startTime === startTime)
      available = slot?.available ?? false
    } else {
      available = await isSlotAvailable(date, startTime, serviceId)
    }
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
  if (!available) {
    return NextResponse.json(
      { success: false, error: 'Este horario ya no está disponible. Por favor elige otro.' },
      { status: 409 }
    )
  }

  // Calculate end time
  const startMinutes = timeToMinutes(startTime)
  const endTime = minutesToTime(startMinutes + computedDuration)

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59`)

  // Create appointment inside a serializable transaction with overlap re-check,
  // to prevent double booking under concurrent requests.
  // Comparison of "HH:MM" in 24h format with leading zero is
  // equivalent to chronological comparison.
  let appointment: AppointmentWithService
  try {
    appointment = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          date: { gte: dayStart, lt: dayEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true },
      })

      if (conflict) {
        throw new SlotTakenError()
      }

      return tx.appointment.create({
        data: {
          clientName: clientName.trim(),
          clientEmail: clientEmail.toLowerCase().trim(),
          clientPhone: clientPhone.trim(),
          serviceId,
          totalDurationMinutes: computedDuration,
          date: dayStart,
          startTime,
          endTime,
          status: 'CONFIRMED', // auto-confirmed: the 24h reminder is sent automatically
          notes: notes?.trim() ?? null,
          services: {
            create: services.map((s) => ({
              serviceId: s.id,
              price: s.price,
            })),
          },
        },
        include: {
          service: {
            select: { id: true, name: true, price: true, durationMinutes: true },
          },
          services: {
            include: {
              service: {
                select: { id: true, name: true, price: true, durationMinutes: true },
              },
            },
          },
        },
      }) as unknown as AppointmentWithService
    }, { isolationLevel: 'Serializable' })
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json(
        { success: false, error: 'Este horario acaba de ser reservado. Por favor elige otro.' },
        { status: 409 }
      )
    }
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error creando cita:', err)
    return NextResponse.json(
      { success: false, error: 'No se pudo crear la cita. Intenta de nuevo.' },
      { status: 500 }
    )
  }

  // Non-blocking tasks: confirmation email + Google Calendar event
  Promise.all([
    sendConfirmationEmail(appointment as AppointmentWithService)
      .then(() => prisma.appointment.update({
        where: { id: appointment.id },
        data:  { confirmationSentAt: new Date() },
      }))
      .catch((err) => console.error('Error enviando confirmación:', err)),

    createCalendarEvent(appointment as AppointmentWithService)
      .then((eventId) => {
        if (eventId) {
          return prisma.appointment.update({
            where: { id: appointment.id },
            data:  { calendarEventId: eventId },
          })
        }
      })
      .catch((err) => console.error('Error creando evento de calendario:', err)),
  ])

  return NextResponse.json(
    { success: true, data: appointment as AppointmentWithService },
    { status: 201 }
  )
}
