'use client'
// src/components/admin/SessionProvider.tsx
// Required wrapper for useSession() in admin client components

import { SessionProvider } from 'next-auth/react'

export default function AdminSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <SessionProvider>{children}</SessionProvider>
}
