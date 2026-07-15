'use client'
// src/components/ui/ConfirmDialog.tsx
// Reusable confirmation modal — replaces the native browser confirm() so
// destructive/critical admin actions match the site's visual identity
// instead of popping a generic browser dialog.
//
// Usage:
//   const confirm = useConfirm()
//   async function remove() {
//     if (!(await confirm({ message: '¿Eliminar este gasto?', danger: true }))) return
//     ...
//   }

import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ConfirmOptions {
  title?:        string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  /** Styles the confirm button as a destructive (red) action. */
  danger?:       boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

// Fallback for components rendered outside the provider (e.g. unit tests that
// mount a single page in isolation) — degrades to the native dialog instead
// of throwing, so the styled modal is additive, never a hard requirement.
const nativeFallback: ConfirmFn = (options) =>
  Promise.resolve(typeof window !== 'undefined' ? window.confirm(options.message) : true)

const ConfirmContext = createContext<ConfirmFn>(nativeFallback)

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  // React 19 requires an initial value; keep the previous "starts empty" type.
  const resolveRef = useRef<((value: boolean) => void) | undefined>(undefined)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function close(result: boolean) {
    resolveRef.current?.(result)
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {options && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog" aria-modal="true"
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-xl text-ink mb-2">
              {options.title ?? (options.danger ? '¿Estás segura?' : 'Confirmar acción')}
            </h2>
            <p className="text-sm text-ink-muted-deep leading-relaxed mb-6">{options.message}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => close(false)} className="btn-secondary flex-1 text-sm">
                {options.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                autoFocus
                className={
                  options.danger
                    ? 'flex-1 rounded-full px-6 py-2.5 text-xs tracking-widest uppercase font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors'
                    : 'btn-primary flex-1 text-sm'
                }
              >
                {options.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
