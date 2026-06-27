// src/app/api/appointments/[id]/route.ts
// GET    /api/appointments/:id   → get appointment by ID (admin)
// PATCH  /api/appointments/:id   → update status/notes (admin)
// DELETE /api/appointments/:id   → delete appointment (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateAppointmentSchema } from '@/lib/validations'
import { timeToMinutes, minutesToTime } from '@/lib/availability'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { sendRescheduledEmail } from '@/lib/email'
import { isWithinCancelWindow } from '@/lib/cancellation'
import { computeFinalPrice } from '@/lib/discount'
import { formatPrice } from '@/lib/utils'
import type { AppointmentWithService } from '@/types'

export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────
// GET — appointment detail
// ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const appointment = await prisma.appointment.findUnique({
    where: { id },
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
      extras: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Cita no encontrada' },
      { status: 404 }
    )
  }

  // Whether the cancellation page should still offer the "cancel" button:
  // only for live appointments still inside the 24h window. The cancel POST
  // enforces this independently — this flag just drives the UI.
  const cancellable =
    (appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') &&
    isWithinCancelWindow(appointment.date, appointment.startTime)

  // Admin sees everything; the public (confirmation / cancellation page)
  // receives only non-sensitive fields. The id is an unguessable cuid.
  const session = await getServerSession(authOptions)
  if (session) {
    return NextResponse.json({ success: true, data: { ...appointment, cancellable } })
  }

  const { clientName, clientEmail, service, services, date, startTime, endTime, status } = appointment
  return NextResponse.json({
    success: true,
    data: { id, clientName, clientEmail, service, services, date, startTime, endTime, status, cancellable },
  })
}

// ─────────────────────────────────────────
// PATCH — update appointment
// ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
      services: { select: { price: true } },
      extras: true,
    },
  })

  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Cita no encontrada' },
      { status: 404 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body inválido' },
      { status: 400 }
    )
  }

  const parsed = updateAppointmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { status, notes, date, startTime, paymentStatus, paymentMethod, amountPaid,
          descuentoTipo, descuentoValor, descuentoMotivo, extras } = parsed.data
  const updateData: Record<string, unknown> = {}

  // Adicionales: when provided, replace the appointment's full set.
  const extraTotal = (extras ?? appointment.extras ?? []).reduce((sum, e) => sum + e.amount, 0)
  if (extras !== undefined) {
    updateData.extras = {
      deleteMany: {},
      create: extras.map((e) => ({ description: e.description.trim(), amount: e.amount })),
    }
  }

  // Capture the previous date/time before mutating, to detect a reschedule
  // and to know what to show as "antes" in the notification email.
  // Compared as Date instants (not formatted strings) to stay consistent
  // with how `date` is parsed/stored everywhere else (new Date(`${date}T00:00:00`)),
  // independent of the server's local timezone.
  const oldStartTime = appointment.startTime
  const isReschedule =
    (date !== undefined && new Date(`${date}T00:00:00`).getTime() !== appointment.date.getTime()) ||
    (startTime !== undefined && startTime !== oldStartTime)

  if (status !== undefined) updateData.status = status
  if (notes  !== undefined) updateData.notes  = notes

  // Pago
  if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus
  if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod
  if (amountPaid    !== undefined) updateData.amountPaid    = amountPaid

  // Manual discount applied/cleared from the detail. Subtotal = service(s) + extra.
  let discountAudit: { descuentoTipo: 'PORCENTAJE' | 'VALOR_FIJO'; descuentoValor: number; precioFinal: number } | null = null
  let discountCleared = false
  if (descuentoTipo === null || descuentoValor === null) {
    // Explicit clear: remove the saved discount, price reverts to the subtotal.
    discountCleared = true
    updateData.descuentoTipo   = null
    updateData.descuentoValor  = null
    updateData.descuentoMotivo = null
    updateData.precioFinal     = null
  } else if (descuentoTipo !== undefined && descuentoValor !== undefined) {
    const svcSubtotal = appointment.services && appointment.services.length > 1
      ? appointment.services.reduce((sum, s) => sum + s.price, 0)
      : appointment.service.price
    const subtotal = svcSubtotal + extraTotal
    if (descuentoTipo === 'VALOR_FIJO' && descuentoValor > subtotal) {
      return NextResponse.json(
        { success: false, error: 'El descuento no puede superar el subtotal.' },
        { status: 400 }
      )
    }
    const precioFinal = computeFinalPrice(subtotal, descuentoTipo, descuentoValor)
    discountAudit = { descuentoTipo, descuentoValor, precioFinal }
    updateData.descuentoTipo   = descuentoTipo
    updateData.descuentoValor  = descuentoValor
    updateData.descuentoMotivo = descuentoMotivo?.trim() || null
    updateData.precioFinal     = precioFinal
  }

  // Saving a full payment IS completing the appointment: a paid (or courtesy)
  // appointment is done. So recording PAID/WAIVED auto-completes it — unless an
  // explicit status was sent, or the appointment is cancelled/no-show (those are
  // separate flows). A PARTIAL payment (deposit) does NOT complete it.
  const completesByPayment =
    (paymentStatus === 'PAID' || paymentStatus === 'WAIVED') &&
    status === undefined &&
    (appointment.status === 'PENDING' || appointment.status === 'CONFIRMED')
  if (completesByPayment) updateData.status = 'COMPLETED'
  const effectiveStatus = status ?? (completesByPayment ? 'COMPLETED' : undefined)

  // If date/time changes, recalculate endTime
  if (date) updateData.date = new Date(`${date}T00:00:00`)
  if (startTime) {
    updateData.startTime = startTime
    updateData.endTime = minutesToTime(
      timeToMinutes(startTime) + appointment.totalDurationMinutes
    )
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: updateData,
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
      extras: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (status === 'CONFIRMED') {
    console.log(`✅ Cita ${id} confirmada. El cron enviará recordatorio 24h antes.`)
  }

  // Notify the client when the admin actually moved the date/time —
  // skip if the same request also cancels it (no point notifying a move
  // for an appointment that no longer stands).
  if (isReschedule && updated.status !== 'CANCELLED') {
    sendRescheduledEmail(updated as unknown as AppointmentWithService, appointment.date, oldStartTime)
      .catch((err) => console.error('Error enviando email de reprogramación:', err))
  }

  const discountLabel = discountAudit
    ? (discountAudit.descuentoTipo === 'PORCENTAJE' ? `${discountAudit.descuentoValor}%` : formatPrice(discountAudit.descuentoValor))
    : null

  const auditDescription =
    discountLabel               ? `Admin aplicó descuento de ${discountLabel} en la cita de ${updated.clientName}${descuentoMotivo?.trim() ? ` (motivo: ${descuentoMotivo.trim()})` : ''}` :
    discountCleared             ? `Admin quitó el descuento de la cita de ${updated.clientName}` :
    completesByPayment          ? `Admin registró el pago y completó la cita de ${updated.clientName}` :
    status !== undefined        ? `Admin cambió el estado de la cita de ${updated.clientName} a ${status}` :
    isReschedule                ? `Admin reprogramó la cita de ${updated.clientName}` :
    paymentStatus !== undefined ? `Admin actualizó el pago de la cita de ${updated.clientName}` :
                                  `Admin editó la cita de ${updated.clientName}`

  await audit({
    action:    effectiveStatus !== undefined ? 'STATUS_CHANGE' : 'UPDATE',
    entity:    'APPOINTMENT',
    entityId:  id,
    actorType: 'ADMIN',
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description: auditDescription,
    before: {
      status:        appointment.status,
      paymentStatus: appointment.paymentStatus,
      amountPaid:    appointment.amountPaid,
      date:          appointment.date.toISOString().slice(0, 10),
      startTime:     appointment.startTime,
      ...(discountAudit || discountCleared ? { precioFinal: appointment.precioFinal } : {}),
    },
    after: {
      ...(effectiveStatus !== undefined ? { status: effectiveStatus } : {}),
      ...(paymentStatus !== undefined ? { paymentStatus } : {}),
      ...(amountPaid    !== undefined ? { amountPaid } : {}),
      ...(date          ? { date } : {}),
      ...(startTime     ? { startTime } : {}),
      ...(notes         !== undefined ? { notes } : {}),
      ...(discountAudit ?? {}),
      ...(discountCleared ? { descuentoTipo: null, descuentoValor: null, precioFinal: null } : {}),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

// ─────────────────────────────────────────
// DELETE — delete appointment (soft delete via cancellation)
// ─────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params

  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    )
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  })

  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Cita no encontrada' },
      { status: 404 }
    )
  }

  // Soft delete: mark as cancelled instead of deleting
  await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  await audit({
    action:    'STATUS_CHANGE',
    entity:    'APPOINTMENT',
    entityId:  id,
    actorType: 'ADMIN',
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description: `Admin canceló la cita de ${appointment.clientName} (desde el panel)`,
    before:    { status: appointment.status },
    after:     { status: 'CANCELLED' },
    metadata:  { via: 'DELETE' },
  })

  return NextResponse.json({
    success: true,
    data: { id, deleted: true },
  })
}
