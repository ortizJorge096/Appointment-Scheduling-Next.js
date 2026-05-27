// src/components/ui/Input.tsx
import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  error?:   string
  dark?:    boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, dark = false, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="form-label">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(dark ? 'input-dark' : 'input-field', error && 'border-red-400', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
