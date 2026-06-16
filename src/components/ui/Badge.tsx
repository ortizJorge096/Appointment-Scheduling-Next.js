// src/components/ui/Badge.tsx
import { cn } from '@/lib/utils'

type BadgeVariant = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  pending:   'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
  no_show:   'badge-no_show',
  default:   'bg-gray-100 text-gray-600 text-xs px-2.5 py-1 font-medium',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn(variants[variant], className)}>
      {children}
    </span>
  )
}

// Helper to map AppointmentStatus → BadgeVariant
export function statusToBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    PENDING:   'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW:   'no_show',
  }
  return map[status] ?? 'default'
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW:   'No asistió',
}
