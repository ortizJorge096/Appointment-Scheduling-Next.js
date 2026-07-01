// src/lib/authz.ts
// Authorization helpers for admin API routes. The JWT session callback already
// invalidates deactivated/stale tokens, but these helpers re-confirm the admin
// against the DB so sensitive endpoints never trust a token blindly.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type AdminRole = 'ADMIN' | 'SUPER_ADMIN'

export interface CurrentAdmin {
  id: string
  email: string
  name: string
  role: AdminRole
}

/** The signed-in admin, re-validated against the DB (must exist and be active),
 *  or null. Use in API routes instead of trusting the session payload. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: string } | undefined)?.id
  if (!id) return null

  const u = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  })
  if (!u || !u.isActive) return null

  return { id: u.id, email: u.email, name: u.name, role: u.role as AdminRole }
}

/** The signed-in admin only if they are a SUPER_ADMIN, else null. */
export async function requireSuperAdmin(): Promise<CurrentAdmin | null> {
  const admin = await getCurrentAdmin()
  return admin?.role === 'SUPER_ADMIN' ? admin : null
}
