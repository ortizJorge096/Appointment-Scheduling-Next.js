// src/app/api/professionals/route.ts
// GET  /api/professionals  → list (admin sees all, public sees only active)
// POST /api/professionals  → create (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createProfessionalSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  // Active-only is the safe default for everyone — the public booking flow must
  // never show inactive professionals, even when an admin happens to be logged
  // in on the same browser. Listing inactive ones is opt-in (admin panel) and
  // requires both an explicit flag and a session.
  const includeInactive =
    !!session && new URL(request.url).searchParams.get('includeInactive') === 'true'

  try {
    const professionals = await prisma.professional.findMany({
      // Soft-deleted professionals never show.
      where: includeInactive ? { deletedAt: null } : { deletedAt: null, isActive: true },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json({ success: true, data: professionals })
  } catch (error) {
    if (isDbUnavailable(error)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'servicios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
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
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Profesional "${professional.name}" creado`,
  })

  return NextResponse.json({ success: true, data: professional }, { status: 201 })
}
