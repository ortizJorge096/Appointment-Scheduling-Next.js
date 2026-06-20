// src/app/admin/(protected)/layout.tsx
// Protects ONLY admin routes — the login page is outside this scope

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin/Sidebar'
import AdminSessionProvider from '@/components/admin/SessionProvider'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'

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
      <ConfirmDialogProvider>
        <div className="min-h-screen bg-beige/30 flex">
          <AdminSidebar />
          {/* pt-14 on mobile clears the fixed top bar; reset on md+ */}
          <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
            {children}
          </main>
        </div>
      </ConfirmDialogProvider>
    </AdminSessionProvider>
  )
}
