'use client'
// src/components/admin/ForcePasswordChangeGuard.tsx
// While the signed-in admin must change their password (freshly created, or an
// admin reset their password), keep them on /admin/perfil until they do — every
// other admin page redirects there. It clears itself once the change flips
// mustChangePassword to false (the auth session callback re-reads it, and
// PerfilForm calls update() on success). UX layer only — the API is the real
// boundary (account/password enforces the current password).

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const CHANGE_PASSWORD_PATH = '/admin/perfil'

export default function ForcePasswordChangeGuard() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status !== 'authenticated') return
    const must = (session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword
    if (must && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH)
    }
  }, [status, session, pathname, router])

  return null
}
