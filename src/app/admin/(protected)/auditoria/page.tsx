// src/app/admin/(protected)/auditoria/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/authz'
import AuditoriaPageClient from './AuditoriaPageClient'

export const metadata: Metadata = { title: 'Auditoría' }

export default async function AuditoriaPage() {
  if (!(await requirePermission('auditoria:ver'))) redirect('/admin/no-autorizado')

  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto flex items-center gap-3 text-ink-muted">
        <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    }>
      <AuditoriaPageClient />
    </Suspense>
  )
}
