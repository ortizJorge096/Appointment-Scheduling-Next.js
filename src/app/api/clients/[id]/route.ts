// src/app/api/clients/[id]/route.ts
// GET   /api/clients/:id  → detail + appointment history
// PATCH /api/clients/:id  → update client data

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateClientSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

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
  try {
    client = await prisma.client.update({
      where: { id },
      data: {
        ...(parsed.data.name  ? { name:  parsed.data.name.trim()  } : {}),
        ...(parsed.data.email ? { email: parsed.data.email.toLowerCase().trim() } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone?.trim() ?? null } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes?.trim() ?? null } : {}),
      },
      include: { _count: { select: { appointments: true } } },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    if ((err as { code?: string }).code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Cliente no encontrado' }, { status: 404 })
    }
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Ya existe un cliente con ese email' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  await audit({
    action:    'UPDATE',
    entity:    'CLIENT',
    entityId:  id,
    actorType: 'ADMIN',
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description: `Admin editó los datos de ${client.name}`,
    before:    prev ?? undefined,
    after:     { name: client.name, email: client.email, phone: client.phone, notes: client.notes },
  })

  return NextResponse.json({ success: true, data: client })
}
