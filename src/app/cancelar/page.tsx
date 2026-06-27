// src/app/cancelar/page.tsx
import { Suspense } from 'react'
import CancelarClient from './CancelarClient'

// noindex: this page carries a per-appointment cancel token in the URL and must
// never be indexed by search engines.
export const metadata = { title: 'Cancelar cita', robots: { index: false, follow: false } }

export default function CancelarPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-beige flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted text-sm">Cargando...</p>
        </div>
      </main>
    }>
      <CancelarClient />
    </Suspense>
  )
}
