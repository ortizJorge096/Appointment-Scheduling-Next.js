'use client'
// src/components/admin/Pagination.tsx
// Reusable pagination control for admin lists.

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-ink-muted">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 rounded-lg border border-beige-dark disabled:opacity-30 hover:bg-beige/40 transition-colors"
      >
        ← Anterior
      </button>
      <span>Página {page} de {totalPages}</span>
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-3 py-1.5 rounded-lg border border-beige-dark disabled:opacity-30 hover:bg-beige/40 transition-colors"
      >
        Siguiente →
      </button>
    </div>
  )
}
