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
import { audit, getClientIp } from '@/lib/audit'
import { sendRescheduledEmail } from '@/lib/email'
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
    },
  })

  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Cita no encontrada' },
      { status: 404 }
    )
  }

  // Admin sees everything; the public (confirmation / cancellation page)
  // receives only non-sensitive fields. The id is an unguessable cuid.
  const session = await getServerSession(authOptions)
  if (session) {
    return NextResponse.json({ success: true, data: appointment })
  }

  const { clientName, clientEmail, service, services, date, startTime, endTime, status } = appointment
  return NextResponse.json({
    success: true,
    data: { id, clientName, clientEmail, service, services, date, startTime, endTime, status },
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

  const { status, notes, date, startTime, paymentStatus, paymentMethod, amountPaid } = parsed.data
  const updateData: Record<string, unknown> = {}

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

  await audit({
    action:    status !== undefined ? 'STATUS_CHANGE' : 'UPDATE',
    entity:    'APPOINTMENT',
    entityId:  id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    metadata:  {
      ...(status !== undefined ? { statusFrom: appointment.status, statusTo: status } : {}),
      ...(paymentStatus !== undefined ? { paymentStatus } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(isReschedule ? {
        rescheduledFrom: `${appointment.date.toISOString().slice(0, 10)} ${oldStartTime}`,
        rescheduledTo:   `${date ?? appointment.date.toISOString().slice(0, 10)} ${startTime ?? oldStartTime}`,
      } : {}),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

// ─────────────────────────────────────────
// DELETE — delete appointment (soft delete via cancellation)
// ─────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
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
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(_request),
    metadata:  { statusFrom: appointment.status, statusTo: 'CANCELLED', via: 'DELETE' },
  })

  return NextResponse.json({
    success: true,
    data: { id, deleted: true },
  })
}
