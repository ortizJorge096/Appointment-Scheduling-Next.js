// src/components/ui/ToggleSwitch.tsx
// On/off switch. Was hand-rolled twice as a <span onClick> — no role, no
// aria-checked, no keyboard: unusable with a screen reader or without a mouse.
//
// A real <button role="switch"> fixes all of it at once: buttons are focusable
// and Enter/Space activate them natively, role+aria-checked announce it as a
// switch and its state, and the focus ring matches the rest of the controls.

import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
  /** Accessible name — what the switch controls (e.g. "Descuento VIP"). */
  label: string
  /** Show the visual "Activo/Inactivo" text before the switch. */
  showStateText?: boolean
  /** Dimmed and non-interactive (e.g. while a save is in flight). */
  disabled?: boolean
  className?: string
}

export function ToggleSwitch({
  checked, onChange, label, showStateText = true, disabled = false, className,
}: ToggleSwitchProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 shrink-0', className)}>
      {showStateText && (
        <span className="text-sm text-ink-muted-deep">{checked ? 'Activo' : 'Inactivo'}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
        className={cn(
          // border-ink-muted (4.87:1 on white) gives the track a visible boundary
          // in both states — without it the off state (bg-beige-dark) is 1.36:1
          // on a white card, i.e. an off switch you cannot see (WCAG 1.4.11).
          'w-11 h-6 rounded-full relative transition-colors shrink-0 border border-ink-muted',
          checked ? 'bg-gold' : 'bg-beige-dark',
          disabled && 'opacity-60 cursor-not-allowed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-deep',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </span>
  )
}
