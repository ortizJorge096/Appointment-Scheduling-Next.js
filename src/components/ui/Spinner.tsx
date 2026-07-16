// src/components/ui/Spinner.tsx
// Inline loading spinner. Decorative — aria-hidden, since the busy state is
// announced by aria-busy on the control that owns it, not by this glyph.
// Inherits size (1em) and color (currentColor) from its parent, so it matches
// whatever text it sits next to.

import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn('inline-block h-[1em] w-[1em] animate-spin', className)}
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
