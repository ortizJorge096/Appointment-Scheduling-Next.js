'use client'
// src/components/admin/DescuentoEditor.tsx
// Shared collapsible discount editor (manual discount: % or fixed COP). Used by
// the manual-appointment modal ("Cita pasada") and the appointment detail PAGO
// block so the UI stays identical and isn't duplicated. Presentational and
// controlled — the parent owns the subtotal, the discount calculation and the
// "too big" validation; this only renders the inputs and reports changes.

export type DescuentoTipo = 'PORCENTAJE' | 'VALOR_FIJO'

interface DescuentoEditorProps {
  open: boolean
  tipo: DescuentoTipo
  valor: string
  motivo: string
  /** Error message to surface (e.g. fixed discount > subtotal). */
  error?: string | null
  onAdd: () => void
  onRemove: () => void
  onChange: (patch: Partial<{ tipo: DescuentoTipo; valor: string; motivo: string }>) => void
}

export default function DescuentoEditor({
  open, tipo, valor, motivo, error, onAdd, onRemove, onChange,
}: DescuentoEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="form-label !mb-0">Descuento</span>
        {open ? (
          <button type="button" onClick={onRemove}
            className="text-xs text-ink-muted-deep hover:text-red-700 transition-colors">− Quitar descuento</button>
        ) : (
          <button type="button" onClick={onAdd}
            className="text-xs text-gold-deep hover:underline">+ Agregar descuento</button>
        )}
      </div>

      {/* Smooth expand via grid-rows 0fr → 1fr */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex items-center gap-2 pt-3">
            <div className="flex rounded-lg border border-beige-dark overflow-hidden shrink-0">
              {(['PORCENTAJE', 'VALOR_FIJO'] as const).map((t) => (
                <button key={t} type="button" onClick={() => onChange({ tipo: t })}
                  className={`px-3 py-2 text-sm transition-colors ${
                    tipo === t ? 'bg-gold text-ink' : 'bg-white text-ink-muted-deep hover:text-ink'
                  }`}>
                  {t === 'PORCENTAJE' ? '%' : '$'}
                </button>
              ))}
            </div>
            <input type="number" min={0} step={tipo === 'PORCENTAJE' ? 1 : 1000}
              max={tipo === 'PORCENTAJE' ? 100 : undefined}
              className={`input-field w-[120px] ${error ? 'border-red-400' : ''}`}
              value={valor} onChange={(e) => onChange({ valor: e.target.value })}
              placeholder={tipo === 'PORCENTAJE' ? '0–100' : '0'} />
          </div>
          <input className="input-field w-full mt-2" value={motivo}
            onChange={(e) => onChange({ motivo: e.target.value })}
            placeholder="Motivo del descuento (interno, opcional)…" />
          {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}
