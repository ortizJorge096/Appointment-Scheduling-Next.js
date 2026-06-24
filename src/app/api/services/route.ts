// src/app/api/services/route.ts
// GET  /api/services  → list active services (public)
// POST /api/services  → create service (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createServiceSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  const services = await prisma.service.findMany({
    // Soft-deleted services never show. Admin sees active+inactive; public only active.
    where: session ? { deletedAt: null } : { deletedAt: null, isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      categoryId: true,
      category: {
        select: { id: true, name: true, slug: true, icon: true, order: true },
      },
      price: true,
      durationMinutes: true,
      isActive: true,
      order: true,
    },
  })

  return NextResponse.json({ success: true, data: services })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = createServiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  // The category must exist and be available (not soft-deleted).
  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, deletedAt: null },
    select: { id: true },
  })
  if (!category) {
    return NextResponse.json(
      { success: false, error: 'La categoría seleccionada no existe.' },
      { status: 400 }
    )
  }

  const service = await prisma.service.create({ data: parsed.data })

  await audit({
    action:    'CREATE',
    entity:    'SERVICE',
    entityId:  service.id,
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    metadata:  { name: service.name, price: service.price },
  })

  return NextResponse.json({ success: true, data: service }, { status: 201 })
}
