// src/app/api/account/password/route.ts
// POST /api/account/password — the signed-in admin changes their own password.
// Verifies the current password, applies the strong-password policy, re-hashes,
// and stamps passwordChangedAt (which invalidates this account's other sessions).

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { changePasswordSchema } from '@/lib/validations'
import { getCurrentAdmin } from '@/lib/authz'
import { audit, getClientIp } from '@/lib/audit'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { currentPassword, newPassword } = parsed.data

  try {
    const user = await prisma.user.findUnique({ where: { id: admin.id }, select: { password: true } })
    if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'La contraseña actual es incorrecta' }, { status: 400 })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: admin.id },
      data:  { password: hash, passwordChangedAt: new Date(), mustChangePassword: false },
    })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error cambiando contraseña:', err)
    return NextResponse.json({ success: false, error: 'No se pudo cambiar la contraseña' }, { status: 500 })
  }

  await audit({
    action: 'UPDATE', entity: 'AUTH', entityId: admin.id, actorType: 'ADMIN',
    userEmail: admin.email, ip: getClientIp(request),
    description: `${admin.name} cambió su contraseña`,
  })

  return NextResponse.json({ success: true })
}
