// src/components/ui/Card.tsx
import { cn } from '@/lib/utils'

interface CardProps {
  children:   React.ReactNode
  className?: string
  padding?:   'sm' | 'md' | 'lg'
}

const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8 lg:p-10' }

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn('bg-white border border-beige-dark rounded-2xl shadow-sm', paddings[padding], className)}>
      {children}
    </div>
  )
}

// Dark card for sections on dark background
export function DarkCard({ children, className }: Omit<CardProps, 'padding'>) {
  return (
    <div className={cn('bg-white/[0.04] border border-white/10 rounded-2xl p-6', className)}>
      {children}
    </div>
  )
}

// Stat card for dashboard metrics
interface StatCardProps {
  label:     string
  value:     string | number
  accent?:   boolean
  className?: string
}

export function StatCard({ label, value, accent = false, className }: StatCardProps) {
  return (
    <div className={cn(
      'bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200',
      accent ? 'border-gold' : 'border-beige-dark',
      className
    )}>
      <p className="text-[11px] text-ink-muted tracking-widest uppercase mb-2 font-medium">{label}</p>
      <p className={cn('font-serif text-3xl font-light leading-none', accent ? 'text-gold' : 'text-ink')}>
        {value}
      </p>
    </div>
  )
}
