'use client'
// Client-side page guard for admin pages that are Client Components (so they
// can't run the server-side requirePermission check). Redirects to
// /admin/no-autorizado when the signed-in admin lacks `permission`.
//
// The role comes from the session, which the auth `session` callback re-reads
// from the DB each request — so this mirrors the server enforcement and reflects
// role changes without a re-login. This is a UX layer: the API routes remain the
// real security boundary (every mutation is permission-checked server-side).

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { hasPermission, type Permission } from '@/lib/permissions'

export function usePermissionGuard(permission: Permission): void {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // 'loading' → wait; 'unauthenticated' → the protected layout redirects to login.
    if (status !== 'authenticated') return
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!hasPermission(role, permission)) {
      router.replace('/admin/no-autorizado')
    }
  }, [status, session, permission, router])
}

/**
 * Returns a `can(permission)` checker for the signed-in admin's role. Used to
 * hide mutating controls on pages a role can view but not edit (e.g. a
 * recepcionista viewing a service catalog). UX only — the API still enforces.
 */
export function useCan(): (permission: Permission) => boolean {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  return (permission: Permission) => hasPermission(role, permission)
}
