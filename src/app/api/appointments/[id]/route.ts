// src/app/api/appointments/[id]/route.ts
// GET    /api/appointments/:id   → get appointment by ID (admin)
// PATCH  /api/appointments/:id   → update status/notes (admin)
// DELETE /api/appointments/:id   → delete appointment (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission, type Permission } from '@/lib/permissions'
import { updateAppointmentSchema } from '@/lib/validations'
import { timeToMinutes, minutesToTime } from '@/lib/availability'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { sendRescheduledEmail } from '@/lib/email'
import { isWithinCancelWindow } from '@/lib/cancellation'
import { computeAppointmentTotal } from '@/lib/discount'
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

  // precioFinal is the client's own final (discounted) price — safe to expose and
  // needed so the confirmation page shows the discounted total, not the gross sum.
  const { clientName, clientEmail, service, services, date, startTime, endTime, status, precioFinal } = appointment
  return NextResponse.json({
    success: true,
    data: { id, clientName, clientEmail, service, services, date, startTime, endTime, status, precioFinal, cancellable },
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

  const admin = await getCurrentAdmin()
  if (!admin) {
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
      services: { select: { id: true, price: true, descuentoTipo: true, descuentoValor: true } },
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
          descuentoTipo, descuentoValor, descuentoMotivo, extras, services: serviceLines } = parsed.data

  // Granular permission by intent: paying vs cancelling vs a generic edit.
  const touchesPayment = paymentStatus !== undefined || amountPaid !== undefined || paymentMethod !== undefined
  const requiredPerm: Permission =
    touchesPayment ? 'citas:pago' : status === 'CANCELLED' ? 'citas:cancelar' : 'citas:editar'
  if (!hasPermission(admin.role, requiredPerm)) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  // ── Add service lines to an existing appointment (admin edit) ──
  // Self-contained path: creates the new AppointmentService rows and grows the
  // appointment's duration, endTime and charge (precioFinal). An already-PAID
  // appointment whose total now exceeds what was collected flips to PARTIAL, so
  // the difference surfaces as a receivable in accounting.
  const addServiceIds = parsed.data.addServiceIds
  if (addServiceIds && addServiceIds.length > 0) {
    if (appointment.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'No se pueden agregar servicios a una cita cancelada.' }, { status: 400 })
    }
    const newServices = await prisma.service.findMany({
      where:  { id: { in: addServiceIds } },
      select: { id: true, name: true, price: true, durationMinutes: true },
    })
    if (newServices.length !== addServiceIds.length) {
      return NextResponse.json({ success: false, error: 'Uno o más servicios no existen.' }, { status: 404 })
    }

    // Full recompute: existing lines (with their discounts/extras) + the new lines
    // + general extras + any order-level discount → the new charge total.
    const existingSvcRows = appointment.services ?? []
    const existingLines = existingSvcRows.length > 0
      ? existingSvcRows.map((sv) => ({
          price:          sv.price,
          descuentoTipo:  sv.descuentoTipo ?? null,
          descuentoValor: sv.descuentoValor ?? null,
          extras:         appointment.extras.filter((e) => e.appointmentServiceId === sv.id).map((e) => e.amount),
        }))
      : [{ price: appointment.service.price, descuentoTipo: null, descuentoValor: null, extras: [] as number[] }]
    const newLines = newServices.map((s) => ({ price: s.price, descuentoTipo: null, descuentoValor: null, extras: [] as number[] }))
    const generalExtras = appointment.extras.filter((e) => !e.appointmentServiceId).map((e) => e.amount)
    const orderDiscount = appointment.descuentoValor != null
      ? { tipo: appointment.descuentoTipo, valor: appointment.descuentoValor }
      : undefined
    const bd = computeAppointmentTotal([...existingLines, ...newLines], generalExtras, orderDiscount)
    const newTotal = bd.total

    const addedDuration    = newServices.reduce((sum, s) => sum + s.durationMinutes, 0)
    const newTotalDuration = appointment.totalDurationMinutes + addedDuration
    const newEndTime       = minutesToTime(timeToMinutes(appointment.startTime) + newTotalDuration)

    // A paid appointment that now costs more than was collected owes the difference.
    const flipsToPartial =
      appointment.paymentStatus === 'PAID' &&
      appointment.amountPaid != null &&
      appointment.amountPaid < newTotal

    // Legacy rows have no AppointmentService for the primary service — backfill it
    // so the appointment becomes a consistent multi-line record after the add.
    const backfillPrimary = existingSvcRows.length === 0

    const addInclude = {
      service:  { select: { id: true, name: true, price: true, durationMinutes: true } },
      services: { include: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } } },
      extras:   { orderBy: { createdAt: 'asc' as const } },
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (backfillPrimary) {
        await tx.appointmentService.create({
          data: { appointmentId: id, serviceId: appointment.serviceId, serviceName: appointment.service.name, price: appointment.service.price },
        })
      }
      await tx.appointmentService.createMany({
        data: newServices.map((s) => ({ appointmentId: id, serviceId: s.id, serviceName: s.name, price: s.price })),
      })
      return tx.appointment.update({
        where: { id },
        data: {
          totalDurationMinutes: newTotalDuration,
          endTime:              newEndTime,
          precioFinal:          newTotal,
          ...(flipsToPartial ? { paymentStatus: 'PARTIAL' } : {}),
        },
        include: addInclude,
      })
    })

    await audit({
      action:    'UPDATE',
      entity:    'APPOINTMENT',
      entityId:  id,
      actorType: 'ADMIN',
      userEmail: admin.email,
      ip:        getClientIp(request),
      userAgent: getUserAgent(request),
      description: `Admin agregó ${newServices.length} servicio(s) a la cita de ${updated.clientName}${flipsToPartial ? ' (queda pago parcial)' : ''}`,
      before: { totalDurationMinutes: appointment.totalDurationMinutes, precioFinal: appointment.precioFinal, paymentStatus: appointment.paymentStatus },
      after:  { totalDurationMinutes: newTotalDuration, precioFinal: newTotal, ...(flipsToPartial ? { paymentStatus: 'PARTIAL' } : {}), addedServices: newServices.map((s) => s.name) },
    })

    return NextResponse.json({ success: true, data: updated })
  }

  const updateData: Record<string, unknown> = {}

  // ── Money: per-service discounts + per-line/general extras, OR an order-level
  // discount (mutually exclusive, enforced by the schema). We recompute the final
  // total for the precioFinal snapshot; amountPaid stays admin-controlled. ──
  const perLineDiscount  = (serviceLines ?? []).some((l) => l.descuentoTipo != null && (l.descuentoValor ?? 0) > 0)
  const orderDiscountSet = descuentoTipo != null && descuentoValor != null && descuentoValor > 0
  const orderDiscountCleared = descuentoTipo === null || descuentoValor === null

  const existingExtras = appointment.extras ?? []
  const linePatch = new Map((serviceLines ?? []).map((l) => [l.appointmentServiceId, l]))
  const svcRows = appointment.services ?? []
  const finalLines = svcRows.length > 0
    ? svcRows.map((sv) => {
        const p = linePatch.get(sv.id)
        return {
          price:          sv.price,
          descuentoTipo:  perLineDiscount ? (p ? (p.descuentoTipo ?? null) : sv.descuentoTipo) : null,
          descuentoValor: perLineDiscount ? (p ? (p.descuentoValor ?? null) : sv.descuentoValor) : null,
          extras:         p?.extras
            ? p.extras.map((e) => e.amount)
            : existingExtras.filter((e) => e.appointmentServiceId === sv.id).map((e) => e.amount),
        }
      })
    // Legacy single-service appointment without AppointmentService rows.
    : [{ price: appointment.service.price, descuentoTipo: null, descuentoValor: null, extras: [] as number[] }]
  const finalGeneralExtras = (extras !== undefined ? extras : existingExtras.filter((e) => !e.appointmentServiceId)).map((e) => e.amount)
  const breakdown = computeAppointmentTotal(
    finalLines, finalGeneralExtras,
    orderDiscountSet ? { tipo: descuentoTipo, valor: descuentoValor } : undefined,
  )
  if (orderDiscountSet && descuentoTipo === 'VALOR_FIJO' && descuentoValor > breakdown.servicesSubtotal + breakdown.extrasTotal) {
    return NextResponse.json({ success: false, error: 'El descuento no puede superar el subtotal.' }, { status: 400 })
  }

  // Capture the previous date/time before mutating, to detect a reschedule.
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

  // Order-level discount snapshot on the appointment (per-line discounts live on
  // the lines; per-line mode clears the order snapshot).
  let discountAudit: { descuentoTipo: 'PORCENTAJE' | 'VALOR_FIJO'; descuentoValor: number; precioFinal: number } | null = null
  let discountCleared = false
  if (orderDiscountSet) {
    discountAudit = { descuentoTipo: descuentoTipo!, descuentoValor: descuentoValor!, precioFinal: breakdown.total }
    updateData.descuentoTipo   = descuentoTipo
    updateData.descuentoValor  = descuentoValor
    updateData.descuentoMotivo = descuentoMotivo?.trim() || null
    updateData.precioFinal     = breakdown.total
  } else if (orderDiscountCleared || perLineDiscount) {
    discountCleared = orderDiscountCleared
    updateData.descuentoTipo   = null
    updateData.descuentoValor  = null
    updateData.descuentoMotivo = null
    updateData.precioFinal     = perLineDiscount ? breakdown.total : null
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

  const includeFull = {
    service:  { select: { id: true, name: true, price: true, durationMinutes: true } },
    services: { include: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } } },
    extras:   { orderBy: { createdAt: 'asc' as const } },
  }

  const hasPerLine = !!(serviceLines && serviceLines.length > 0)

  // Without per-line changes, general extras are replaced inline (single atomic
  // update — keeps the common path simple). The per-line path uses a transaction.
  if (extras !== undefined && !hasPerLine) {
    updateData.extras = {
      deleteMany: {},
      create: extras.map((e) => ({ description: e.description.trim(), amount: e.amount })),
    }
  }

  const updated = hasPerLine
    ? await prisma.$transaction(async (tx) => {
        for (const l of serviceLines!) {
          await tx.appointmentService.update({
            where: { id: l.appointmentServiceId },
            data: {
              descuentoTipo:   perLineDiscount ? (l.descuentoTipo ?? null) : null,
              descuentoValor:  perLineDiscount ? (l.descuentoValor ?? null) : null,
              descuentoMotivo: perLineDiscount ? (l.descuentoMotivo?.trim() || null) : null,
            },
          })
          // Replace this line's extras when the payload includes them.
          if (l.extras) {
            await tx.appointmentExtra.deleteMany({ where: { appointmentServiceId: l.appointmentServiceId } })
            if (l.extras.length > 0) {
              await tx.appointmentExtra.createMany({
                data: l.extras.map((e) => ({ appointmentId: id, appointmentServiceId: l.appointmentServiceId, description: e.description.trim(), amount: e.amount })),
              })
            }
          }
        }
        // Exclusivity: an order-level discount clears any per-line discounts.
        if (orderDiscountSet) {
          await tx.appointmentService.updateMany({ where: { appointmentId: id }, data: { descuentoTipo: null, descuentoValor: null, descuentoMotivo: null } })
        }
        // General extras (not tied to a line) replaced when provided.
        if (extras !== undefined) {
          await tx.appointmentExtra.deleteMany({ where: { appointmentId: id, appointmentServiceId: null } })
          if (extras.length > 0) {
            await tx.appointmentExtra.createMany({ data: extras.map((e) => ({ appointmentId: id, description: e.description.trim(), amount: e.amount })) })
          }
        }
        return tx.appointment.update({ where: { id }, data: updateData, include: includeFull })
      })
    : await prisma.appointment.update({ where: { id }, data: updateData, include: includeFull })

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
    userEmail: admin.email,
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
      ...(extras !== undefined ? { extras: appointment.extras.map((e) => ({ description: e.description, amount: e.amount })) } : {}),
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
      ...(extras !== undefined ? { extras } : {}),
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

  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'citas:cancelar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
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
    userEmail: admin.email,
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
