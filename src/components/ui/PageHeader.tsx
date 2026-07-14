// src/components/ui/PageHeader.tsx
// Shared admin page header: small uppercase eyebrow + serif title + optional
// subtitle, with right-aligned actions. Replaces the same block repeated across
// ~13 admin pages.

interface PageHeaderProps {
  title: string
  eyebrow?: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, eyebrow, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow && <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">{eyebrow}</p>}
        <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
