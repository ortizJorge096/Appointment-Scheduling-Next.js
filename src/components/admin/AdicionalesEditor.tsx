'use client'
// src/components/admin/AdicionalesEditor.tsx
// Reusable collapsible list editor for "adicionales" (extra services/products)
// attached to an appointment. Self-contained header (label + "+ Agregar" /
// "Ocultar" toggle on the same row) so the manual-appointment modal and the
// appointment detail render an identical block — same pattern as DescuentoEditor.
// Controlled: the parent owns `items` (calculation/validation) and the open state.

export interface Adicional {
  description: string
  amount: string // raw input value, parsed by the caller
}

interface AdicionalesEditorProps {
  items: Adicional[]
  onChange: (items: Adicional[]) => void
  open: boolean
  onAdd: () => void
  onRemove: () => void
}

export default function AdicionalesEditor({ items, onChange, open, onAdd, onRemove }: AdicionalesEditorProps) {
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
    <div>
      <div className="flex items-center justify-between">
        <span className="form-label !mb-0">Adicional (opcional)</span>
        {open ? (
          <button type="button" onClick={onRemove}
            className="text-xs text-ink-muted hover:text-ink transition-colors">Ocultar</button>
        ) : (
          <button type="button" onClick={onAdd}
            className="text-xs text-gold hover:underline">+ Agregar adicional</button>
        )}
      </div>

      {/* Smooth expand via grid-rows 0fr → 1fr */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="pt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-start">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Descripción del adicional…"
                  className="input-field flex-1 min-w-[160px]"
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
        </div>
      </div>
    </div>
  )
}
