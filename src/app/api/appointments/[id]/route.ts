// src/app/api/appointments/[id]/route.ts
// GET    /api/appointments/:id   → obtener cita por ID (admin)
// PATCH  /api/appointments/:id   → actualizar estado/notas (admin)
// DELETE /api/appointments/:id   → eliminar cita (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateAppointmentSchema } from '@/lib/validations'
import { sendReminderEmail } from '@/lib/email'
import { timeToMinutes, minutesToTime } from '@/lib/availability'
import type { AppointmentWithService } from '@/types'

type Params = { params: { id: string } }

export const dynamic = 'force-dynamic'
// ─────────────────────────────────────────
// GET — detalle de una cita
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
    },
  })

  if (!appointment) {
    return NextResponse.json(
      { success: false, error: 'Cita no encontrada' },
      { status: 404 }
    )
  }

  // El admin ve todo; el público (página de confirmación / cancelación)
  // recibe solo campos no sensibles. El id es un cuid no adivinable.
  const session = await getServerSession(authOptions)
  if (session) {
    return NextResponse.json({ success: true, data: appointment })
  }

  const { clientName, clientEmail, service, date, startTime, endTime, status } = appointment
  return NextResponse.json({
    success: true,
    data: { id, clientName, clientEmail, service, date, startTime, endTime, status },
  })
}

// ─────────────────────────────────────────
// PATCH — actualizar cita
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

  const { status, notes, date, startTime } = parsed.data
  const updateData: Record<string, unknown> = {}

  if (status) updateData.status = status
  if (notes !== undefined) updateData.notes = notes

  // Si se cambia fecha/hora, recalcular endTime
  if (date) updateData.date = new Date(`${date}T00:00:00`)
  if (startTime) {
    updateData.startTime = startTime
    updateData.endTime = minutesToTime(
      timeToMinutes(startTime) + appointment.service.durationMinutes
    )
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: updateData,
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
    },
  })

  if (status === 'CONFIRMED') {
    console.log(`✅ Cita ${id} confirmada. El cron enviará recordatorio 24h antes.`)
  }

  return NextResponse.json({ success: true, data: updated })
}

// ─────────────────────────────────────────
// DELETE — eliminar cita (soft delete via cancelación)
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

  // Soft delete: marcar como cancelada en lugar de eliminar
  await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  return NextResponse.json({
    success: true,
    data: { id, deleted: true },
  })
}
