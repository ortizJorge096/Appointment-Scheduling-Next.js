// src/app/admin/(protected)/no-autorizado/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Sin acceso' }

export default function NoAutorizadoPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
      <div className="bg-white rounded-xl border border-beige-dark p-8 sm:p-10 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="font-serif text-2xl text-ink mb-2">Sin acceso</h1>
        <p className="text-sm text-ink-muted-deep mb-6 leading-relaxed">
          Tu rol no tiene permiso para ver esta sección. Si crees que es un error,
          contacta a un super administrador.
        </p>
        <Link href="/admin" className="btn-cta">Volver al panel</Link>
      </div>
    </div>
  )
}
