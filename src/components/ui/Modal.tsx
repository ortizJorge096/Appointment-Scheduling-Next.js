'use client'
// src/components/ui/Modal.tsx
// Shared modal shell (backdrop + centered panel + optional titled header). Replaces
// the duplicated `fixed inset-0 z-50 … bg-ink/40 backdrop-blur-sm` overlay in the
// create/edit form modals. Adds Escape-to-close and click-outside-to-close.
// (ConfirmDialog stays separate — it's for yes/no confirmations, not forms.)

import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Panel width utility, e.g. "max-w-md" (default) or "max-w-lg". */
  maxWidth?: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, maxWidth = 'max-w-md', children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-ink/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxWidth}`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-beige-dark">
            <h2 className="font-serif text-xl text-ink">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="text-ink-muted-deep hover:text-ink text-xl leading-none">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
