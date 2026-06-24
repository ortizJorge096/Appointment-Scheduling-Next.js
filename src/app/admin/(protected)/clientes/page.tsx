// src/app/admin/(protected)/clientes/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import ClientesPageClient from './ClientesPageClient'

export const metadata: Metadata = { title: 'Clientes' }

export default function ClientesPage() {
  return (
    <Suspense fallback={
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto flex items-center gap-3 text-ink-muted">
        <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        Cargando...
      </div>
    }>
      <ClientesPageClient />
    </Suspense>
  )
}
