// src/app/api/clients/route.ts
// GET  /api/clients   → listar clientes (admin)
// POST /api/clients   → crear cliente (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClientSchema } from '@/lib/validations'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import type { ApiResponse, ClientSummary } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

  const where = search
    ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

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
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

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
        name:  parsed.data.name.trim(),
        email: parsed.data.email.toLowerCase().trim(),
        phone: parsed.data.phone?.trim() ?? null,
        notes: parsed.data.notes?.trim() ?? null,
      },
      include: { _count: { select: { appointments: true } } },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    // P2002 = unique constraint (email duplicado)
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Ya existe un cliente con ese email' }, { status: 409 })
    }
    console.error('Error creando cliente:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: client as unknown as ClientSummary }, { status: 201 })
}
