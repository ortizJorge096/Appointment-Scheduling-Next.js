// src/components/ui/SubmitButton.tsx
// The submit/save button pattern, extracted. It was hand-rolled in ~18 places,
// each re-deriving the same four things slightly differently: the disabled
// logic, the (missing) aria-busy, the spinner, and ad-hoc loading text
// ("Guardando..." vs "Guardando…" vs "Confirmando...").
//
// A behavior primitive, not a styled button: the caller keeps its own visual
// class (btn-primary, btn-cta, …). This only adds the four things that were
// hand-rolled and inconsistent — disabled logic, aria-busy, the spinner, and a
// clean loading label.
//
// `loading` and `disabled` are kept SEPARATE on purpose. They overlap but are
// not the same: a button is busy while it saves, but it may also be disabled for
// a reason that is not busy at all (an invalid discount, an unchanged form).
// Only `loading` drives aria-busy and the spinner — announcing "busy" for a
// validation block would lie to a screen reader. `disabled` is folded in so the
// button can't be clicked either way. A button that is merely disabled because
// *another* control is submitting (a "back" button mid-submit) is not busy and
// should stay a plain <button disabled>.

import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Busy state: drives aria-busy, the spinner, and disables the button. */
  loading?: boolean
  /** Optional label shown next to the spinner while loading (defaults to children). */
  loadingLabel?: React.ReactNode
}

export function SubmitButton({
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: SubmitButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={cn(className)}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          {loadingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
