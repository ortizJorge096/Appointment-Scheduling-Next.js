// src/app/api/clients/[id]/route.ts
// GET    /api/clients/:id → detail + appointment history
// PATCH  /api/clients/:id → update client data, or archive/reactivate (archived flag)
// DELETE /api/clients/:id → hard-delete (only when the client has no appointments)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { updateClientSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'
import { normalizePhone } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'clientes:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { id } = await params

  let client
  try {
    client = await prisma.client.findUnique({
      where: { id },
      include: {
        appointments: {
          include: {
            service: { select: { id: true, name: true, price: true, durationMinutes: true } },
            services: {
              include: {
                service: { select: { id: true, name: true, price: true, durationMinutes: true } },
              },
            },
          },
          orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        },
        _count: { select: { appointments: true } },
      },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  if (!client) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })

  return NextResponse.json({ success: true, data: client })
}

export async function PATCH(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'clientes:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { id } = await params

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = updateClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  // Snapshot the current values for the audit "before"
  const prev = await prisma.client.findUnique({
    where: { id },
    select: { name: true, email: true, phone: true, notes: true },
  })

  let client
  let syncedAppointments = 0
  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: { id },
        data: {
          ...(parsed.data.name  ? { name:  parsed.data.name.trim()  } : {}),
          ...(parsed.data.email ? { email: parsed.data.email.toLowerCase().trim() } : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone?.trim() ?? null, phoneNormalized: normalizePhone(parsed.data.phone) } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() ?? null } : {}),
          ...(parsed.data.archived !== undefined ? { deletedAt: parsed.data.archived ? new Date() : null } : {}),
        },
        include: { _count: { select: { appointments: true } } },
      })

      // Appointments keep a denormalized copy of the client's contact data so the
      // history survives if the client record is deleted. That copy must FOLLOW a
      // correction here — otherwise the citas list keeps showing the old name, and
      // the admin search (which runs on the denormalized clientName via its GIN
      // trigram index) stops finding the client by their new name. Same transaction
      // so the profile and its appointments can never drift apart.
      const sync: { clientName?: string; clientEmail?: string | null; clientPhone?: string } = {}
      if (prev) {
        if (updated.name  !== prev.name)  sync.clientName  = updated.name
        if (updated.email !== prev.email) sync.clientEmail = updated.email
        // clientPhone is NOT nullable on the appointment — never blank out a snapshot.
        if (updated.phone && updated.phone !== prev.phone) sync.clientPhone = updated.phone
      }
      const synced = Object.keys(sync).length > 0
        ? (await tx.appointment.updateMany({ where: { clientId: id }, data: sync })).count
        : 0

      return { updated, synced }
    })
    client = result.updated
    syncedAppointments = result.synced
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
    if ((err as { code?: string }).code === 'P2002') {
      const target = String((err as { meta?: { target?: unknown } }).meta?.target ?? '')
      const field  = target.includes('phone') ? 'teléfono' : 'email'
      return NextResponse.json({ success: false, error: `Ya existe un cliente con ese ${field}` }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  const description =
    parsed.data.archived === true  ? `Admin archivó a ${client.name}` :
    parsed.data.archived === false ? `Admin reactivó a ${client.name}` :
    syncedAppointments > 0
      ? `Admin editó los datos de ${client.name} (sincronizó ${syncedAppointments} cita(s))`
      : `Admin editó los datos de ${client.name}`
  await audit({
    action:    parsed.data.archived !== undefined ? 'STATUS_CHANGE' : 'UPDATE',
    entity:    'CLIENT',
    entityId:  id,
    actorType: 'ADMIN',
    userEmail: admin.email,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description,
    before:    prev ?? undefined,
    after:     { name: client.name, email: client.email, phone: client.phone, notes: client.notes },
    ...(syncedAppointments > 0 ? { metadata: { syncedAppointments } } : {}),
  })

  return NextResponse.json({ success: true, data: client })
}

export async function DELETE(request: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'clientes:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { id } = await params

  try {
    const target = await prisma.client.findUnique({
      where: { id },
      select: { name: true, _count: { select: { appointments: true } } },
    })
    if (!target) return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })

    // Preserve history: a client with appointments can't be hard-deleted (it would
    // orphan the record their bookings point to). The UI offers archiving instead.
    if (target._count.appointments > 0) {
      return NextResponse.json(
        { success: false, error: 'Este cliente tiene citas registradas. Archívalo en lugar de eliminarlo.' },
        { status: 409 },
      )
    }

    await prisma.client.delete({ where: { id } })

    await audit({
      action:    'DELETE',
      entity:    'CLIENT',
      entityId:  id,
      actorType: 'ADMIN',
      userEmail: admin.email,
      ip:        getClientIp(request),
      userAgent: getUserAgent(request),
      description: `Admin eliminó al cliente ${target.name}`,
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error eliminando cliente:', err)
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el cliente' }, { status: 500 })
  }
}
