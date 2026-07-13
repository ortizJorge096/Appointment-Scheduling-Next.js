// src/app/api/clients/route.ts
// GET  /api/clients   → list clients (admin)
// POST /api/clients   → create client (admin)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { createClientSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { audit, getClientIp } from '@/lib/audit'
import { normalizePhone } from '@/lib/utils'
import type { ApiResponse, ClientSummary } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'clientes:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

  // Archived (soft-deleted) clients are hidden by default; ?archived=1 lists them.
  const showArchived = searchParams.get('archived') === '1'
  const where = {
    deletedAt: showArchived ? { not: null } : null,
    ...(search
      ? {
          OR: [
            { name:  { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  let clients, total
  try {
    ;[clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { appointments: true } } },
      }),
      prisma.client.count({ where }),
    ])
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error listando clientes:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      clients: clients as unknown as ClientSummary[],
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    },
  })
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<ClientSummary>>> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'clientes:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  let client
  try {
    client = await prisma.client.create({
      data: {
        name:            parsed.data.name.trim(),
        email:           parsed.data.email?.toLowerCase().trim() || null,
        phone:           parsed.data.phone?.trim() ?? null,
        phoneNormalized: normalizePhone(parsed.data.phone),
        notes:           parsed.data.notes?.trim() ?? null,
      },
      include: { _count: { select: { appointments: true } } },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    // P2002 = unique constraint (duplicate email or phone)
    if ((err as { code?: string }).code === 'P2002') {
      const target = String((err as { meta?: { target?: unknown } }).meta?.target ?? '')
      const field  = target.includes('phone') ? 'teléfono' : 'email'
      return NextResponse.json({ success: false, error: `Ya existe un cliente con ese ${field}` }, { status: 409 })
    }
    console.error('Error creando cliente:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  await audit({
    action:      'CREATE',
    entity:      'CLIENT',
    entityId:    client.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Cliente "${client.name}" creado`,
  })

  return NextResponse.json({ success: true, data: client as unknown as ClientSummary }, { status: 201 })
}
