'use client'
// src/components/admin/AdicionalesEditor.tsx
// Reusable list editor for "adicionales" (extra services/products) attached to
// an appointment. Used in the manual-appointment modal and the appointment
// detail PAGO block, so both stay in sync with the same UI/behavior.

export interface Adicional {
  description: string
  amount: string // raw input value, parsed by the caller
}

interface AdicionalesEditorProps {
  items: Adicional[]
  onChange: (items: Adicional[]) => void
}

export default function AdicionalesEditor({ items, onChange }: AdicionalesEditorProps) {
  function addItem() {
    onChange([...items, { description: '', amount: '' }])
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, patch: Partial<Adicional>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            value={item.description}
            onChange={(e) => updateItem(i, { description: e.target.value })}
            placeholder="Descripción del adicional…"
            className="input-field flex-1"
          />
          <input
            type="number" min={0} step={1000}
            value={item.amount}
            onChange={(e) => updateItem(i, { amount: e.target.value })}
            placeholder="$ valor"
            className="input-field w-[120px]"
          />
          <button type="button" onClick={() => removeItem(i)}
            aria-label="Eliminar adicional"
            className="text-ink-muted hover:text-red-500 transition-colors px-2 py-2.5 text-lg leading-none">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-xs text-gold hover:underline">
        + {items.length > 0 ? 'Agregar otro' : 'Agregar adicional'}
      </button>
    </div>
  )
}
