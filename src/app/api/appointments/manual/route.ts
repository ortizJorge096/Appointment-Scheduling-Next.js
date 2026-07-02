// src/app/api/appointments/manual/route.ts
// POST /api/appointments/manual
// Creates an appointment from admin (WhatsApp, phone, walk-in).
// Admin only. No rate limit. Can skip availability validation.
// Automatically creates or links a Client profile.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { STUDIO } from '@/lib/config'
import { createManualAppointmentSchema } from '@/lib/validations'
import { timeToMinutes, minutesToTime } from '@/lib/availability'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { sendConfirmationEmail } from '@/lib/email'
import { resolveOrCreateClient } from '@/lib/clients'
import { computeFinalPrice } from '@/lib/discount'
import { formatPrice } from '@/lib/utils'
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
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'citas:crear')) {
    return NextResponse.json({ success: false, error: 'Sin permiso para crear citas' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = createManualAppointmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const {
    clientName, clientEmail, clientPhone, clientId: pickedClientId,
    serviceId, serviceIds, date, startTime, source, notes,
    skipAvailabilityCheck, notifyClient,
    mode, totalCharged, extras,
    descuentoTipo, descuentoValor, descuentoMotivo,
  } = parsed.data

  const extraTotal = (extras ?? []).reduce((sum, e) => sum + e.amount, 0)

  // Date/time window depends on the mode (business timezone is authoritative).
  const todayBogota = toZonedTime(new Date(), STUDIO.timezone)
  const todayStr    = format(todayBogota, 'yyyy-MM-dd')
  const nowHHMM     = format(todayBogota, 'HH:mm')
  const minDateStr  = format(subDays(todayBogota, PAST_LIMIT_DAYS), 'yyyy-MM-dd')

  if (mode === 'PAST') {
    // Backfill window: [today - PAST_LIMIT_DAYS, today]. Today is allowed only
    // with a time strictly earlier than the current moment.
    if (date < minDateStr) {
      return NextResponse.json(
        { success: false, error: `Solo puedes registrar citas de hasta ${PAST_LIMIT_DAYS} días atrás.` },
        { status: 400 }
      )
    }
    if (date > todayStr) {
      return NextResponse.json(
        { success: false, error: 'Una cita pasada no puede tener una fecha futura.' },
        { status: 400 }
      )
    }
    if (date === todayStr && startTime >= nowHHMM) {
      return NextResponse.json(
        { success: false, error: 'La hora debe ser anterior a la hora actual.' },
        { status: 400 }
      )
    }
  } else {
    // Upcoming: today or later. No past-window limit and no "15 days" message.
    if (date < todayStr) {
      return NextResponse.json(
        { success: false, error: 'Una cita próxima debe tener una fecha de hoy o futura.' },
        { status: 400 }
      )
    }
  }

  // Verify services (one or several). serviceId stays the primary for back-compat.
  const allServiceIds = serviceIds && serviceIds.length > 1 ? serviceIds : [serviceId]
  let servicesList
  try {
    servicesList = await prisma.service.findMany({
      where: { id: { in: allServiceIds } },
      select: { id: true, name: true, price: true, durationMinutes: true },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  if (servicesList.length !== allServiceIds.length) {
    return NextResponse.json({ success: false, error: 'Uno o más servicios no existen' }, { status: 404 })
  }

  const totalDuration = servicesList.reduce((sum, s) => sum + s.durationMinutes, 0)
  const startMinutes  = timeToMinutes(startTime)
  const endTime       = minutesToTime(startMinutes + totalDuration)

  // Manual discount — only on a past appointment's charge. Validate against the
  // subtotal (service + extra) and compute the final price snapshot here.
  let precioFinal: number | null = null
  const hasDiscount = mode === 'PAST' && !!descuentoTipo && descuentoValor != null
  if (hasDiscount) {
    const subtotal = totalCharged! + extraTotal
    if (descuentoTipo === 'VALOR_FIJO' && descuentoValor! > subtotal) {
      return NextResponse.json(
        { success: false, error: 'El descuento no puede superar el subtotal.' },
        { status: 400 }
      )
    }
    precioFinal = computeFinalPrice(subtotal, descuentoTipo, descuentoValor)
  }

  // Check actual appointment conflict (only if admin didn't force the time).
  // We use a direct query instead of isSlotAvailable to avoid false positives
  // when no Schedule exists for that day (e.g. past dates or days without configured hours).
  // Past appointments already happened: they don't compete for a slot, so we
  // never block a backfill on an "occupied" overlapping time.
  if (!skipAvailabilityCheck && mode !== 'PAST') {
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
      if (conflict && !skipAvailabilityCheck && mode !== 'PAST') throw new SlotTakenError()

      // If the admin picked an existing client, reuse that exact profile and
      // save its name/phone (enriches a client that was missing a phone) —
      // avoids creating a duplicate. Otherwise resolve/create by email or
      // phone+name. Email isn't overwritten here (it's the dedup key).
      let clientId: string
      const picked = pickedClientId
        ? await tx.client.findUnique({ where: { id: pickedClientId }, select: { id: true } })
        : null
      if (picked) {
        await tx.client.update({
          where: { id: picked.id },
          data:  { name: clientName.trim(), phone: clientPhone.trim() },
        })
        clientId = picked.id
      } else {
        clientId = await resolveOrCreateClient(tx, {
          name: clientName, email: emailNorm, phone: clientPhone,
        })
      }

      const isPast = mode === 'PAST'
      // Per-service snapshot: catalog price. For a SINGLE-service past charge the
      // whole amount sits on that one service (preserves prior behavior); with
      // multiple services the real total lives in amountPaid.
      const priceFor = (s: { price: number }) =>
        isPast && servicesList.length === 1 ? totalCharged! : s.price

      return tx.appointment.create({
        data: {
          clientName:  clientName.trim(),
          clientEmail: emailNorm,
          clientPhone: clientPhone.trim(),
          clientId,
          serviceId,
          totalDurationMinutes: totalDuration,
          date:        dayStart,
          startTime,
          endTime,
          status:      isPast ? 'COMPLETED' : 'CONFIRMED',
          source,
          origin:      isPast ? 'PAST' : 'MANUAL',
          notes:       notes?.trim() ?? null,
          ...(isPast ? {
            paymentStatus:    'PAID',
            amountPaid:       precioFinal ?? (totalCharged! + extraTotal),
            ...(precioFinal != null ? {
              descuentoTipo,
              descuentoValor,
              descuentoMotivo: descuentoMotivo?.trim() || null,
              precioFinal,
            } : {}),
          } : {}),
          services: {
            create: servicesList.map((s) => ({
              serviceId:   s.id,
              serviceName: s.name, // snapshot — preserves history
              price:       priceFor(s),
            })),
          },
          ...(isPast && extras && extras.length > 0 ? {
            extras: {
              create: extras.map((e) => ({ description: e.description.trim(), amount: e.amount })),
            },
          } : {}),
        },
        include: {
          service: { select: { id: true, name: true, price: true, durationMinutes: true } },
          services: {
            include: {
              service: { select: { id: true, name: true, price: true, durationMinutes: true } },
            },
          },
          extras: { orderBy: { createdAt: 'asc' } },
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

  const discountLabel = precioFinal != null
    ? (descuentoTipo === 'PORCENTAJE' ? `${descuentoValor}%` : formatPrice(descuentoValor!))
    : null

  await audit({
    action:    'CREATE',
    entity:    'APPOINTMENT',
    entityId:  appointment.id,
    userEmail: admin.email,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description: discountLabel
      ? `Descuento de ${discountLabel} aplicado en la cita de ${appointment.clientName}${descuentoMotivo?.trim() ? ` (motivo: ${descuentoMotivo.trim()})` : ''}`
      : undefined,
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
        extras: extras && extras.length > 0 ? extras : undefined,
        amountPaid: appointment.amountPaid,
        ...(precioFinal != null ? { descuentoTipo, descuentoValor, descuentoMotivo: descuentoMotivo?.trim() || undefined, precioFinal } : {}),
      } : {}),
    },
  })

  return NextResponse.json({ success: true, data: appointment }, { status: 201 })
}
