// src/lib/authz.ts
// Authorization helpers for admin routes. Permissions derive from the admin's
// role, which the auth `session` callback already re-reads from the DB each
// request (and clears for deactivated accounts). So these helpers read from the
// session — zero extra queries — and the role is always fresh.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, type Permission, type Role } from '@/lib/permissions'

export type { Role, Permission }

export interface CurrentAdmin {
  id: string
  email: string
  name: string
  role: Role
}

/** The signed-in admin (from the validated session), or null. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await getServerSession(authOptions)
  const u = session?.user as { id?: string; email?: string; name?: string; role?: string } | undefined
  if (!u?.id || !u.role) return null
  return { id: u.id, email: u.email ?? '', name: u.name ?? '', role: u.role as Role }
}

/** The signed-in admin only if they hold `permission`, else null. */
export async function requirePermission(permission: Permission): Promise<CurrentAdmin | null> {
  const admin = await getCurrentAdmin()
  if (!admin) return null
  return hasPermission(admin.role, permission) ? admin : null
}

/** Back-compat gate — equivalent to the 'admins:gestionar' permission (SUPER_ADMIN only). */
export async function requireSuperAdmin(): Promise<CurrentAdmin | null> {
  return requirePermission('admins:gestionar')
}
