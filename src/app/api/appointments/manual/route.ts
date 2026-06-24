// src/app/api/appointments/manual/route.ts
// POST /api/appointments/manual
// Creates an appointment from admin (WhatsApp, phone, walk-in).
// Admin only. No rate limit. Can skip availability validation.
// Automatically creates or links a Client profile.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { createManualAppointmentSchema } from '@/lib/validations'
import { timeToMinutes, minutesToTime } from '@/lib/availability'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'
import { sendConfirmationEmail } from '@/lib/email'
import { resolveOrCreateClient } from '@/lib/clients'
import type { ApiResponse, AppointmentWithService } from '@/types'
import { toZonedTime } from 'date-fns-tz'
import { format, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

// Admins can backfill appointments up to this many days in the past.
const PAST_LIMIT_DAYS = 15

class SlotTakenError extends Error {}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<AppointmentWithService>>> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = createManualAppointmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const {
    clientName, clientEmail, clientPhone,
    serviceId, date, startTime, source, notes,
    skipAvailabilityCheck, notifyClient,
    mode, totalCharged, extraDescription, extraAmount,
  } = parsed.data

  // Backfill window: allow past dates only up to PAST_LIMIT_DAYS days ago
  // (business timezone). Future dates are always allowed for scheduling.
  const todayBogota = toZonedTime(new Date(), STUDIO.timezone)
  const todayStr    = format(todayBogota, 'yyyy-MM-dd')
  const minDateStr  = format(subDays(todayBogota, PAST_LIMIT_DAYS), 'yyyy-MM-dd')
  if (date < minDateStr) {
    return NextResponse.json(
      { success: false, error: `Solo puedes registrar citas de hasta ${PAST_LIMIT_DAYS} días atrás.` },
      { status: 400 }
    )
  }
  if (mode === 'PAST' && date >= todayStr) {
    return NextResponse.json(
      { success: false, error: 'Una cita pasada debe tener una fecha anterior a hoy.' },
      { status: 400 }
    )
  }

  // Verify service
  let service
  try {
    service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, price: true, durationMinutes: true },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  if (!service) {
    return NextResponse.json({ success: false, error: 'Servicio no encontrado' }, { status: 404 })
  }

  const startMinutes = timeToMinutes(startTime)
  const endTime      = minutesToTime(startMinutes + service.durationMinutes)

  // Check actual appointment conflict (only if admin didn't force the time).
  // We use a direct query instead of isSlotAvailable to avoid false positives
  // when no Schedule exists for that day (e.g. past dates or days without configured hours).
  if (!skipAvailabilityCheck) {
    let conflict
    try {
      conflict = await prisma.appointment.findFirst({
        where: {
          date:      new Date(`${date}T00:00:00`),
          status:    { notIn: ['CANCELLED', 'NO_SHOW'] },
          startTime: { lt: endTime },
          endTime:   { gt: startTime },
        },
        select: { id: true },
      })
    } catch (err) {
      if (isDbUnavailable(err)) return dbUnavailableResponse()
      return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
    }
    if (conflict) {
      return NextResponse.json(
        { success: false, error: 'Este horario ya está ocupado.' },
        { status: 409 }
      )
    }
  }
  const dayStart     = new Date(`${date}T00:00:00`)
  const dayEnd       = new Date(`${date}T23:59:59`)
  const emailNorm    = clientEmail?.toLowerCase().trim() || null

  let appointment: AppointmentWithService
  try {
    appointment = await prisma.$transaction(async (tx) => {
      // Schedule conflict (always checked inside the transaction)
      const conflict = await tx.appointment.findFirst({
        where: {
          date:      { gte: dayStart, lt: dayEnd },
          status:    { in: ['PENDING', 'CONFIRMED'] },
          startTime: { lt: endTime },
          endTime:   { gt: startTime },
        },
        select: { id: true },
      })
      if (conflict && !skipAvailabilityCheck) throw new SlotTakenError()

      // Create or retrieve client (by email, or by phone+name when no email)
      const clientId = await resolveOrCreateClient(tx, {
        name: clientName, email: emailNorm, phone: clientPhone,
      })

      const servicePrice = mode === 'PAST' ? totalCharged! : service.price
      const isPast = mode === 'PAST'

      return tx.appointment.create({
        data: {
          clientName:  clientName.trim(),
          clientEmail: emailNorm,
          clientPhone: clientPhone.trim(),
          clientId,
          serviceId,
          totalDurationMinutes: service.durationMinutes,
          date:        dayStart,
          startTime,
          endTime,
          status:      isPast ? 'COMPLETED' : 'CONFIRMED',
          source,
          notes:       notes?.trim() ?? null,
          ...(isPast ? {
            paymentStatus:    'PAID',
            amountPaid:       servicePrice + (extraAmount ?? 0),
            extraDescription: extraDescription?.trim() || null,
            extraAmount:      extraAmount ?? null,
          } : {}),
          services: {
            create: [{
              serviceId,
              serviceName: service.name, // snapshot — preserves history
              price: servicePrice,
            }],
          },
        },
        include: {
          service: { select: { id: true, name: true, price: true, durationMinutes: true } },
          services: {
            include: {
              service: { select: { id: true, name: true, price: true, durationMinutes: true } },
            },
          },
        },
      }) as unknown as AppointmentWithService
    }, { isolationLevel: 'Serializable' })
  } catch (err) {
    if (err instanceof SlotTakenError) {
      return NextResponse.json(
        { success: false, error: 'Este horario ya está reservado. Elige otro.' },
        { status: 409 }
      )
    }
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error creando cita manual:', err)
    return NextResponse.json({ success: false, error: 'No se pudo crear la cita.' }, { status: 500 })
  }

  // Confirmation email is opt-in for manual bookings (the admin controls it via
  // the "Notificar al cliente" checkbox), never applies to "Cita pasada", and
  // is impossible without an email on file.
  if (mode !== 'PAST' && notifyClient && emailNorm) {
    sendConfirmationEmail(appointment)
      .then(() => prisma.appointment.update({
        where: { id: appointment.id },
        data:  { confirmationSentAt: new Date() },
      }))
      .catch((err) => console.error('Error enviando confirmación (cita manual):', err))
  }

  await audit({
    action:    'CREATE',
    entity:    'APPOINTMENT',
    entityId:  appointment.id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    metadata:  {
      clientName:  appointment.clientName,
      clientEmail: appointment.clientEmail,
      service:     appointment.service.name,
      date:        parsed.data.date,
      startTime:   appointment.startTime,
      source:      appointment.source,
      mode,
      notifyClient: mode !== 'PAST' ? notifyClient : undefined,
      ...(mode === 'PAST' ? {
        totalCharged,
        extraDescription: extraDescription?.trim() || undefined,
        extraAmount,
        amountPaid: appointment.amountPaid,
      } : {}),
    },
  })

  return NextResponse.json({ success: true, data: appointment }, { status: 201 })
}
