'use client'
// src/components/ui/Toast.tsx
// Lightweight, dependency-free toast notifications for consistent success/error
// feedback on admin actions, matching the site's visual identity.
//
// Usage:
//   const toast = useToast()
//   toast.success('Pago guardado')
//   toast.error('No se pudo guardar')

import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; type: ToastType; message: string }

interface ToastApi {
  success: (message: string) => void
  error:   (message: string) => void
  info:    (message: string) => void
}

// No-op fallback for components outside the provider (e.g. isolated unit tests),
// so calling a toast is always safe and never throws.
const noop: ToastApi = { success: () => {}, error: () => {}, info: () => {} }
const ToastContext = createContext<ToastApi>(noop)

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

let nextId = 1

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-700',
  error:   'bg-red-50 border-red-200 text-red-700',
  info:    'bg-beige border-beige-dark text-ink',
}
const ICONS: Record<ToastType, string> = { success: '✓', error: '⚠', info: 'ℹ' }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  const api: ToastApi = {
    success: (m) => push('success', m),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-80 max-w-[92vw]">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-fade-in ${STYLES[t.type]}`}>
            <span className="shrink-0">{ICONS[t.type]}</span>
            <span className="flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)}
              aria-label="Cerrar" className="opacity-60 hover:opacity-100 leading-none">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
