// src/app/api/appointments/route.ts
// GET  /api/appointments   → list appointments (admin, with filters)
// POST /api/appointments   → create new appointment (public, with rate limit)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { createAppointmentSchema } from '@/lib/validations'
import { isSlotAvailable, timeToMinutes, minutesToTime } from '@/lib/availability'
import { getVipSettings, resolveDiscountPercent } from '@/lib/vip'
import { sendConfirmationEmail, sendAdminNewBookingEmail } from '@/lib/email'
import { resolveOrCreateClient } from '@/lib/clients'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { createCalendarEvent } from '@/lib/calendar'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { buildAppointmentListQuery } from '@/lib/appointmentList'
import { formatInTimeZone } from 'date-fns-tz'
import type { ApiResponse, AppointmentWithService } from '@/types'

// ─────────────────────────────────────────
// Simple in-memory RATE LIMITING
// (use Redis or Upstash in production)
// ─────────────────────────────────────────

// In-memory rate limiter (single-pod k3s). Resets on restart — acceptable for small studio.
// Migrate to Redis/DB if horizontal scaling is needed.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
let lastRateLimitSweep = Date.now()

// Internal error to abort the transaction when the slot is already taken
class SlotTakenError extends Error {}

export const dynamic = 'force-dynamic'

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000  // 1 hour
  const maxRequests = 5             // max 5 appointments per IP per hour

  // Evict expired entries so the map can't grow unbounded with one-off IPs.
  if (now - lastRateLimitSweep > windowMs) {
    lastRateLimitSweep = now
    for (const [k, e] of rateLimitMap) if (now > e.resetAt) rateLimitMap.delete(k)
  }

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
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'citas:ver')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

  // Parse optional numeric value bounds (ignore non-numbers).
  const num = (v: string | null) => {
    if (v == null || v.trim() === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  const today     = formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd')
  const sortParam = searchParams.get('sort') ?? undefined
  const { where, orderBy } = buildAppointmentListQuery({
    status:     searchParams.get('status')     ?? undefined,
    scope:      searchParams.get('scope')      ?? undefined,
    origin:     searchParams.get('origin')     ?? undefined,
    search:     searchParams.get('search')     ?? undefined,
    serviceId:  searchParams.get('serviceId')  ?? undefined,
    categoryId: searchParams.get('categoryId') ?? undefined,
    amountMin:  num(searchParams.get('amountMin')),
    amountMax:  num(searchParams.get('amountMax')),
    dateFrom:   searchParams.get('dateFrom')   ?? undefined,
    dateTo:     searchParams.get('dateTo')     ?? undefined,
    sort:       sortParam,
    sortExplicit: !!sortParam,
    today,
  })

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
          professional: {
            select: { id: true, name: true },
          },
        },
        orderBy,
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

  const { clientName, clientEmail, clientPhone, serviceId, serviceIds, totalDurationMinutes, professionalId, date, startTime, notes } =
    parsed.data

  // If a specific professional was requested, make sure it exists and is active
  if (professionalId) {
    const professional = await prisma.professional.findUnique({ where: { id: professionalId } })
    if (!professional || !professional.isActive) {
      return NextResponse.json(
        { success: false, error: 'El profesional seleccionado no está disponible' },
        { status: 404 }
      )
    }
  }

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

  // VIP discount: 2+ services (any category) unlock a tiered discount, parametrized in the DB
  const vipSettings = await getVipSettings()
  const discountPercent = resolveDiscountPercent(allServiceIds.length, vipSettings)

  // Preliminary check (valid schedule, not in the past, open day, not blocked)
  let available
  try {
    // Use durationMinutes-based check for multi-service bookings
    if (serviceIds && serviceIds.length > 1) {
      const { getAvailableSlotsByDuration } = await import('@/lib/availability')
      const { slots } = await getAvailableSlotsByDuration(date, computedDuration, professionalId ?? undefined)
      const slot = slots.find((s) => s.startTime === startTime)
      available = slot?.available ?? false
    } else {
      available = await isSlotAvailable(date, startTime, serviceId, professionalId ?? undefined)
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
      // Overlapping appointments in this date/time range, with their professional
      const overlapping = await tx.appointment.findMany({
        where: {
          date: { gte: dayStart, lt: dayEnd },
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { professionalId: true },
      })

      let assignedProfessionalId: string | null = null

      if (professionalId) {
        // Specific professional requested: re-check only their conflicts
        if (overlapping.some((a) => a.professionalId === professionalId)) {
          throw new SlotTakenError()
        }
        assignedProfessionalId = professionalId
      } else {
        // "Primera disponible": assign the first active professional free in this range
        const busyIds = new Set(overlapping.map((a) => a.professionalId).filter(Boolean))
        const activeProfessionals = await tx.professional.findMany({
          where: { isActive: true, deletedAt: null },
          orderBy: { order: 'asc' },
          select: { id: true },
        })
        const free = activeProfessionals.find((p) => !busyIds.has(p.id))
        if (activeProfessionals.length > 0 && !free) {
          throw new SlotTakenError()
        }
        assignedProfessionalId = free?.id ?? null
      }

      // Create or link the client profile (by email, or phone+name when no email)
      const clientId = await resolveOrCreateClient(tx, {
        name: clientName, email: clientEmail, phone: clientPhone,
      })

      return tx.appointment.create({
        data: {
          clientName: clientName.trim(),
          clientEmail: clientEmail?.toLowerCase().trim() || null,
          clientPhone: clientPhone.trim(),
          clientId,
          serviceId,
          totalDurationMinutes: computedDuration,
          discountPercent,
          // VIP = multi-service package; otherwise a normal public self-booking.
          origin: allServiceIds.length > 1 ? 'VIP' : 'PUBLIC',
          professionalId: assignedProfessionalId,
          date: dayStart,
          startTime,
          endTime,
          status: 'CONFIRMED', // auto-confirmed: the 24h reminder is sent automatically
          notes: notes?.trim() ?? null,
          services: {
            create: services.map((s) => ({
              serviceId: s.id,
              serviceName: s.name, // snapshot — preserves history if the service changes later
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
          professional: {
            select: { id: true, name: true },
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

  // Non-blocking tasks: confirmation email + admin notification + Google Calendar event
  Promise.all([
    sendConfirmationEmail(appointment as AppointmentWithService)
      .then(() => prisma.appointment.update({
        where: { id: appointment.id },
        data:  { confirmationSentAt: new Date() },
      }))
      .catch((err) => console.error('Error enviando confirmación:', err)),

    sendAdminNewBookingEmail(appointment as AppointmentWithService)
      .catch((err) => console.error('Error notificando al admin de nueva cita:', err)),

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

  // Audit the public booking (fire-and-forget — never blocks the response)
  audit({
    action:    'CREATE',
    entity:    'APPOINTMENT',
    entityId:  appointment.id,
    actorType: 'CLIENT',
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    after: {
      clientName: appointment.clientName,
      service:    appointment.service.name,
      date,
      startTime,
      source:     'ONLINE',
    },
    description: `Cliente ${appointment.clientName} reservó ${appointment.service.name} para el ${date} a las ${startTime}`,
  })

  return NextResponse.json(
    { success: true, data: appointment as AppointmentWithService },
    { status: 201 }
  )
}
