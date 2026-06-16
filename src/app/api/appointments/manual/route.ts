// src/app/api/appointments/manual/route.ts
// POST /api/appointments/manual
// Crea una cita desde el admin (WhatsApp, teléfono, presencial).
// Solo admins. Sin rate limit. Puede saltar validación de disponibilidad.
// Crea o vincula automáticamente el perfil de Client.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STUDIO } from '@/lib/config'
import { createManualAppointmentSchema } from '@/lib/validations'
import { timeToMinutes, minutesToTime } from '@/lib/availability'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'
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
    skipAvailabilityCheck,
  } = parsed.data

  // Backfill window: allow past dates only up to PAST_LIMIT_DAYS days ago
  // (business timezone). Future dates are always allowed for scheduling.
  const todayBogota = toZonedTime(new Date(), STUDIO.timezone)
  const minDateStr  = format(subDays(todayBogota, PAST_LIMIT_DAYS), 'yyyy-MM-dd')
  if (date < minDateStr) {
    return NextResponse.json(
      { success: false, error: `Solo puedes registrar citas de hasta ${PAST_LIMIT_DAYS} días atrás.` },
      { status: 400 }
    )
  }

  // Verificar servicio
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

  // Verificar conflicto real de citas (solo si admin no forzó el horario).
  // Usamos query directa en lugar de isSlotAvailable para evitar falsos positivos
  // cuando no existe Schedule para ese día (ej. fechas pasadas o días sin horario configurado).
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
  const emailNorm    = clientEmail.toLowerCase().trim()

  let appointment: AppointmentWithService
  try {
    appointment = await prisma.$transaction(async (tx) => {
      // Conflicto de horario (siempre verificamos en la transacción)
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

      // Crear o recuperar cliente
      const client = await tx.client.upsert({
        where:  { email: emailNorm },
        create: { name: clientName.trim(), email: emailNorm, phone: clientPhone.trim() },
        update: { name: clientName.trim(), phone: clientPhone.trim() },
      })

      return tx.appointment.create({
        data: {
          clientName:  clientName.trim(),
          clientEmail: emailNorm,
          clientPhone: clientPhone.trim(),
          clientId:    client.id,
          serviceId,
          date:        dayStart,
          startTime,
          endTime,
          status:      'CONFIRMED',
          source,
          notes:       notes?.trim() ?? null,
        },
        include: {
          service: { select: { id: true, name: true, price: true, durationMinutes: true } },
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
    },
  })

  return NextResponse.json({ success: true, data: appointment }, { status: 201 })
}
