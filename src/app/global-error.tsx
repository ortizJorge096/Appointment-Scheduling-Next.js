'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-beige">
        <main className="min-h-screen flex items-center justify-center px-6 py-16">
          <div className="max-w-md w-full text-center">
            <h1 className="font-serif text-4xl text-ink font-light mb-3">Error crítico</h1>
            <p className="text-ink-muted mb-2">
              No pudimos cargar la aplicación. Recarga la página.
            </p>
            {error.digest && (
              <p className="text-xs text-ink-muted mb-8 font-mono">
                Ref: {error.digest}
              </p>
            )}
            <button onClick={reset} className="btn-primary">
              Recargar
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
