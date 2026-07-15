// src/components/ui/EmptyState.tsx
// Shared "no data" block. Replaces ~13 near-identical inline empty states across
// the admin lists. Icon and action (e.g. a "create the first" button) are optional.

interface EmptyStateProps {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`py-16 px-6 text-center ${className}`.trim()}>
      {icon && <div className="text-3xl opacity-40 mb-2">{icon}</div>}
      <p className="text-ink-muted-deep text-sm">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
