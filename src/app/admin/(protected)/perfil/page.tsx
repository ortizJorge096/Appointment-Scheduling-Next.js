// src/app/admin/(protected)/perfil/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/authz'
import { ROLE_LABELS } from '@/lib/permissions'
import PerfilForm from './PerfilForm'
import { PageHeader } from '@/components/ui/PageHeader'

export const metadata: Metadata = { title: 'Mi perfil' }
export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
      <PageHeader className="mb-6" eyebrow="Cuenta" title="Mi perfil" />

      <div className="bg-white rounded-xl border border-beige-dark p-5 mb-5 space-y-1 text-sm">
        <p className="text-ink"><span className="text-ink-muted">Nombre:</span> {admin.name}</p>
        <p className="text-ink"><span className="text-ink-muted">Email:</span> {admin.email}</p>
        <p className="text-ink"><span className="text-ink-muted">Rol:</span> {ROLE_LABELS[admin.role]}</p>
      </div>

      <PerfilForm />
    </div>
  )
}
