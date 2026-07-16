// src/app/admin/(protected)/clientes/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/authz'
import ClientesPageClient from './ClientesPageClient'

export const metadata: Metadata = { title: 'Clientes' }

export default async function ClientesPage() {
  if (!(await requirePermission('clientes:ver'))) redirect('/admin/no-autorizado')

  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto flex items-center gap-3 text-ink-muted-deep">
        <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    }>
      <ClientesPageClient />
    </Suspense>
  )
}
