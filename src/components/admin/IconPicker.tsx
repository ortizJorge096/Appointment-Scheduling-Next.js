'use client'
// src/components/admin/IconPicker.tsx
// Lets the admin pick a category icon from the predefined set (ICON_KEYS).
// Stores the chosen key (string); the public flow renders it via <Icon name=...>.

import { ICON_KEYS, ICON_LABELS } from '@/lib/config'
import { Icon } from '@/components/public/ServiceIcons'

export function IconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
      {ICON_KEYS.map((key) => {
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            title={ICON_LABELS[key]}
            aria-label={ICON_LABELS[key]}
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={`flex items-center justify-center aspect-square rounded-lg border transition-colors
              ${selected
                ? 'border-gold bg-gold-pale text-gold-deep ring-1 ring-gold'
                : 'border-beige-dark text-ink-muted-deep hover:border-gold/50 hover:text-gold-dark'}`}
          >
            <Icon name={key} className="w-6 h-6" />
          </button>
        )
      })}
    </div>
  )
}
