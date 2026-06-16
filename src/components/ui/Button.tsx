// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?:    'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium tracking-widest uppercase rounded-full transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary:   'bg-gold text-white hover:bg-ink',
      secondary: 'bg-transparent text-ink border border-ink hover:bg-ink hover:text-white',
      ghost:     'bg-transparent text-ink-muted hover:text-gold hover:bg-beige',
      danger:    'bg-transparent text-red-500 border border-red-300 hover:bg-red-50',
    }

    const sizes = {
      sm: 'text-[10px] px-4 py-2',
      md: 'text-xs px-6 py-3',
      lg: 'text-xs px-8 py-3.5',
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
