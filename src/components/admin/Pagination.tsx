'use client'
// src/components/admin/Pagination.tsx
// Reusable pagination control for admin lists.
//
// Two modes, same look:
// - `onPage`: client-state pages (e.g. fetch-driven lists) — renders buttons.
// - `hrefFor`: Server Component pages whose page lives in the URL — renders
//   real <Link> navigation instead of onClick handlers.

import Link from 'next/link'

type PaginationProps = { page: number; totalPages: number } & (
  | { onPage: (p: number) => void; hrefFor?: undefined }
  | { hrefFor: (p: number) => string; onPage?: undefined }
)

const BTN_CLASS  = 'px-4 min-h-11 inline-flex items-center rounded-lg border border-beige-dark disabled:opacity-30 hover:bg-beige/40 transition-colors'
const LINK_CLASS = 'px-4 min-h-11 inline-flex items-center rounded-lg border border-beige-dark hover:bg-beige/40 transition-colors'
const LINK_DISABLED_CLASS = 'px-4 min-h-11 inline-flex items-center rounded-lg border border-beige-dark opacity-30 pointer-events-none'

export function Pagination({ page, totalPages, onPage, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null

  const prevDisabled = page === 1
  const nextDisabled = page === totalPages

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-ink-muted">
      {hrefFor ? (
        prevDisabled
          ? <span className={LINK_DISABLED_CLASS}>← Anterior</span>
          : <Link href={hrefFor(page - 1)} className={LINK_CLASS}>← Anterior</Link>
      ) : (
        <button onClick={() => onPage(Math.max(1, page - 1))} disabled={prevDisabled} className={BTN_CLASS}>
          ← Anterior
        </button>
      )}
      <span>Página {page} de {totalPages}</span>
      {hrefFor ? (
        nextDisabled
          ? <span className={LINK_DISABLED_CLASS}>Siguiente →</span>
          : <Link href={hrefFor(page + 1)} className={LINK_CLASS}>Siguiente →</Link>
      ) : (
        <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={nextDisabled} className={BTN_CLASS}>
          Siguiente →
        </button>
      )}
    </div>
  )
}
