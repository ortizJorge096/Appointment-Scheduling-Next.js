// src/app/api/users/[id]/route.ts
// Admin management — SUPER_ADMIN only.
//   PATCH  → edit name/email/role/isActive or reset password
//   DELETE → remove an admin (only if they have no audit history)

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { updateUserSchema } from '@/lib/validations'
import { requireSuperAdmin } from '@/lib/authz'
import { audit, getClientIp } from '@/lib/audit'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

const SAFE_SELECT = {
  id: true, name: true, email: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
} as const

// True if deactivating/demoting this target would leave zero active SUPER_ADMINs.
async function wouldOrphanSuperAdmin(targetId: string): Promise<boolean> {
  const activeSupers = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } })
  if (activeSupers > 1) return false
  const target = await prisma.user.findUnique({
    where: { id: targetId }, select: { role: true, isActive: true },
  })
  return target?.role === 'SUPER_ADMIN' && target.isActive
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  const { id } = await context.params

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }
  const { name, email, role, isActive, newPassword } = parsed.data

  try {
    const target = await prisma.user.findUnique({
      where: { id }, select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    if (!target) return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 })

    const isSelf = id === admin.id

    // ── Guard rails ──
    if (isSelf && isActive === false)
      return NextResponse.json({ success: false, error: 'No puedes desactivarte a ti mismo' }, { status: 400 })
    if (isSelf && role === 'ADMIN')
      return NextResponse.json({ success: false, error: 'No puedes quitarte el rol de SUPER_ADMIN' }, { status: 400 })

    const demoting     = role === 'ADMIN' && target.role === 'SUPER_ADMIN'
    const deactivating = isActive === false && target.isActive
    if ((demoting || deactivating) && await wouldOrphanSuperAdmin(id))
      return NextResponse.json({ success: false, error: 'Debe quedar al menos un SUPER_ADMIN activo' }, { status: 400 })

    const emailNorm = email?.toLowerCase().trim()
    if (emailNorm && emailNorm !== target.email) {
      const taken = await prisma.user.findUnique({ where: { email: emailNorm }, select: { id: true } })
      if (taken) return NextResponse.json({ success: false, error: 'Ya existe un admin con ese email' }, { status: 409 })
    }

    const data: Prisma.UserUpdateInput = {}
    if (name      !== undefined) data.name     = name.trim()
    if (emailNorm !== undefined) data.email    = emailNorm
    if (role      !== undefined) data.role     = role
    if (isActive  !== undefined) data.isActive = isActive
    if (newPassword) {
      data.password = await bcrypt.hash(newPassword, 12)
      data.passwordChangedAt = new Date()  // invalidates the target's sessions
      data.mustChangePassword = true        // an admin reset → force them to set their own
    }

    const updated = await prisma.user.update({ where: { id }, data, select: SAFE_SELECT })

    const changes = [
      name      !== undefined && 'nombre',
      emailNorm !== undefined && 'email',
      role      !== undefined && `rol→${role}`,
      isActive  !== undefined && (isActive ? 'activado' : 'desactivado'),
      newPassword && 'contraseña restablecida',
    ].filter(Boolean).join(', ')

    await audit({
      action: isActive === false ? 'STATUS_CHANGE' : 'UPDATE', entity: 'AUTH', entityId: id, actorType: 'ADMIN',
      userEmail: admin.email, ip: getClientIp(request),
      description: `${admin.name} actualizó al admin ${target.name}: ${changes}`,
      metadata: { changes },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error actualizando admin:', err)
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el admin' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  const { id } = await context.params

  try {
    const target = await prisma.user.findUnique({
      where: { id }, select: { id: true, name: true, email: true, role: true },
    })
    if (!target) return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 })

    if (id === admin.id)
      return NextResponse.json({ success: false, error: 'No puedes eliminarte a ti mismo' }, { status: 400 })
    if (target.role === 'SUPER_ADMIN' && await wouldOrphanSuperAdmin(id))
      return NextResponse.json({ success: false, error: 'Debe quedar al menos un SUPER_ADMIN activo' }, { status: 400 })

    // Preserve audit history: an admin who ever acted can't be hard-deleted.
    const acted = await prisma.auditLog.count({ where: { userEmail: target.email } })
    if (acted > 0) {
      return NextResponse.json(
        { success: false, error: 'Este admin tiene historial de auditoría. Desactívalo en lugar de eliminarlo.' },
        { status: 409 },
      )
    }

    await prisma.user.delete({ where: { id } })

    await audit({
      action: 'DELETE', entity: 'AUTH', entityId: id, actorType: 'ADMIN',
      userEmail: admin.email, ip: getClientIp(request),
      description: `${admin.name} eliminó al admin ${target.name} (${target.email})`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error eliminando admin:', err)
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el admin' }, { status: 500 })
  }
}
