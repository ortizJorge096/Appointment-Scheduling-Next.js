'use client'
// src/app/admin/(protected)/error.tsx
// Friendly error boundary for admin routes (e.g. database unavailable).
import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-xl mx-auto">
      <div className="bg-white rounded-xl border border-beige-dark p-8 sm:p-10 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="font-serif text-2xl text-ink mb-2">Algo salió mal</h1>
        <p className="text-sm text-ink-muted mb-6 leading-relaxed">
          No pudimos cargar esta sección. Puede ser una interrupción temporal de la
          base de datos. Intenta de nuevo en unos segundos.
        </p>
        <button onClick={reset} className="btn-cta">Reintentar</button>
      </div>
    </div>
  )
}
