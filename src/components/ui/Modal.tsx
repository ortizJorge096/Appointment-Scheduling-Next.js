'use client'
// src/components/ui/Modal.tsx
// Shared modal shell (backdrop + centered panel + optional titled header). Replaces
// the duplicated `fixed inset-0 z-50 … bg-ink/40 backdrop-blur-sm` overlay in the
// create/edit form modals. Adds Escape-to-close and click-outside-to-close.
// (ConfirmDialog stays separate — it's for yes/no confirmations, not forms.)
//
// Dialog semantics live here rather than in each caller: a bare <div> overlay is
// invisible to a screen reader — nothing announces that a dialog opened, Tab walks
// straight out into the page behind it, and focus never comes back on close.

import { useEffect, useId, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Accessible name when there is no visible title — a dialog always needs one. */
  label?: string
  /** Panel width utility, e.g. "max-w-md" (default) or "max-w-lg". */
  maxWidth?: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, label, maxWidth = 'max-w-md', children }: ModalProps) {
  const titleId  = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restore  = useRef<HTMLElement | null>(null)

  // Callers pass an inline arrow, so onClose has a new identity every render.
  // Keeping it in a ref lets the effect depend on `open` alone: as a dependency
  // it re-ran on every parent render and yanked focus back to the first control,
  // which makes the form unusable the moment anything re-renders while typing.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    restore.current = document.activeElement as HTMLElement | null

    // Prefer visible focusables so a collapsed section can't swallow the trap,
    // but fall back to all of them: offsetParent is always null under jsdom,
    // where there is no layout, and the filter would leave nothing to focus.
    const focusables = () => {
      const all = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      const vis = all.filter((el) => el.offsetParent !== null)
      return vis.length ? vis : all
    }

    // Land on the first real control, not the header's close button: × comes
    // first in the DOM, and opening a form onto "exit" is a poor entry point.
    // It stays in the tab order — this only picks where focus starts.
    const list = focusables()
    const entry = list.find((el) => el !== closeRef.current) ?? list[0]
    if (entry) entry.focus()
    else panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) { e.preventDefault(); return }
      const top = els[0], bottom = els[els.length - 1]
      if (e.shiftKey && document.activeElement === top) { e.preventDefault(); bottom.focus() }
      else if (!e.shiftKey && document.activeElement === bottom) { e.preventDefault(); top.focus() }
    }
    window.addEventListener('keydown', onKey)

    // The backdrop scrolls the panel, so the page behind must not scroll too.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restore.current?.focus?.()
    }
  }, [open])

  if (!open) return null
  // The panel caps its own height and scrolls internally, so a long form keeps
  // the titled header (and its close button) in view instead of pushing it away.
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-ink/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[90dvh] overflow-y-auto focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-beige-dark">
            <h2 id={titleId} className="font-serif text-xl text-ink">{title}</h2>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar"
              className="text-ink-muted-deep hover:text-ink text-xl leading-none p-2 -m-2">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
