'use client'
// src/components/ui/Modal.tsx

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open:       boolean
  onClose:    () => void
  title?:     string
  children:   React.ReactNode
  maxWidth?:  'sm' | 'md' | 'lg'
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

export function Modal({ open, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        'relative w-full bg-white border border-beige-dark p-6 animate-fade-in',
        widths[maxWidth]
      )}>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl text-ink font-light">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-gold transition-colors text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
