// src/app/admin/(protected)/layout.tsx
// Protects ONLY admin routes — the login page is outside this scope

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/Sidebar'
import AdminSessionProvider from '@/components/admin/SessionProvider'

export const metadata = {
  title: { template: '%s · Admin', default: 'Admin · Valentina Jimenez' },
}

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/admin/login')

  return (
    <AdminSessionProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AdminSessionProvider>
  )
}
