// src/app/api/professionals/route.ts
// GET  /api/professionals  → list (admin sees all, public sees only active)
// POST /api/professionals  → create (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createProfessionalSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  try {
    const professionals = await prisma.professional.findMany({
      where: session ? {} : { isActive: true },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json({ success: true, data: professionals })
  } catch (error) {
    if (isDbUnavailable(error)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
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

  const parsed = createProfessionalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const professional = await prisma.professional.create({ data: parsed.data })

  await audit({
    action:      'CREATE',
    entity:      'PROFESSIONAL',
    entityId:    professional.id,
    userEmail:   session.user?.email ?? undefined,
    ip:          getClientIp(request),
    description: `Profesional "${professional.name}" creado`,
  })

  return NextResponse.json({ success: true, data: professional }, { status: 201 })
}
