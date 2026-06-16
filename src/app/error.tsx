'use client'

import Link from 'next/link'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="min-h-screen bg-beige flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <h1 className="font-serif text-4xl text-ink font-light mb-3">Algo salió mal</h1>
        <p className="text-ink-muted mb-2">
          Ocurrió un error inesperado. Ya lo registramos.
        </p>
        {/* Only show the digest (opaque) — never the internal message in production */}
        {error.digest && (
          <p className="text-xs text-ink-muted mb-8 font-mono">
            Ref: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="btn-primary">
            Intentar de nuevo
          </button>
          <Link href="/" className="btn-secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
