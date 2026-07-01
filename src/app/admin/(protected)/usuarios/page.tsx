// src/app/admin/(protected)/usuarios/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import UsuariosClient from './UsuariosClient'

export const metadata: Metadata = { title: 'Usuarios' }
export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')
  // Route guard: admin management requires the admins:gestionar permission (SUPER_ADMIN).
  if (!hasPermission(admin.role, 'admins:gestionar')) redirect('/admin/no-autorizado')

  const users = await prisma.user.findMany({
    select:  { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Configuración</p>
        <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Usuarios</h1>
      </div>
      {/* Serialize Date → ISO string so it matches the /api/users response shape. */}
      <UsuariosClient initialUsers={JSON.parse(JSON.stringify(users))} currentAdminId={admin.id} />
    </div>
  )
}
