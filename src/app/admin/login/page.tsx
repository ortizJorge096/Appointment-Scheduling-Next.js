// src/app/admin/login/page.tsx
// Server shell: bounces an already signed-in admin to the dashboard, and only
// then renders the credentials form. Same server-page + client-form split the
// rest of the admin uses (perfil, clientes), and it keeps the session check on
// the server — a client-side check would flash the form before redirecting.
//
// Deliberately not middleware: authorization in this app lives per page
// (requirePermission) and per API route (getCurrentAdmin). A middleware would
// add a second, parallel place to get it wrong.

import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Ingresar' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Showing a login form to someone already signed in is a dead end: it invites
  // re-authenticating as another user without an explicit sign-out.
  const session = await getServerSession(authOptions)
  if (session) redirect('/admin')

  return <LoginForm />
}
