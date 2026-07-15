// src/app/api/users/route.ts
// Admin management — SUPER_ADMIN only.
//   GET  → list admins (never returns the password hash)
//   POST → create a new admin

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createUserSchema } from '@/lib/validations'
import { requireSuperAdmin } from '@/lib/authz'
import { audit, getClientIp } from '@/lib/audit'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

// Explicit field list — NEVER select `password`.
const SAFE_SELECT = {
  id: true, name: true, email: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
} as const

export async function GET() {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })

  try {
    const users = await prisma.user.findMany({
      select:  SAFE_SELECT,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ success: true, data: users })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { name, email, password, role } = parsed.data
  const emailNorm = email.toLowerCase().trim()

  try {
    const exists = await prisma.user.findUnique({ where: { email: emailNorm }, select: { id: true } })
    if (exists) return NextResponse.json({ success: false, error: 'Ya existe un admin con ese email' }, { status: 409 })

    const hash = await bcrypt.hash(password, 12)
    const created = await prisma.user.create({
      data:   { name: name.trim(), email: emailNorm, password: hash, role, passwordChangedAt: new Date(), mustChangePassword: true },
      select: SAFE_SELECT,
    })

    await audit({
      action: 'CREATE', entity: 'AUTH', entityId: created.id, actorType: 'ADMIN',
      userEmail: admin.email, ip: getClientIp(request),
      description: `${admin.name} creó al admin ${created.name} (${created.email}) con rol ${created.role}`,
      metadata: { role: created.role },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error creando admin:', err)
    return NextResponse.json({ success: false, error: 'No se pudo crear el admin' }, { status: 500 })
  }
}
