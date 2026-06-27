'use client'
// src/app/admin/(protected)/contabilidad/page.tsx
// Financial view: appointment revenue + expenses + net profit

import { useState, useEffect, useCallback } from 'react'
import type { ExpenseSummary, AccountingSummary } from '@/types'
import { Pagination } from '@/components/admin/Pagination'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const PER_PAGE = 10

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const EXPENSE_CATEGORIES = ['INSUMOS', 'EQUIPOS', 'SERVICIOS', 'ARRIENDO', 'MARKETING', 'OTROS'] as const
const CAT_LABEL: Record<string, string> = {
  INSUMOS: 'Insumos', EQUIPOS: 'Equipos', SERVICIOS: 'Servicios',
  ARRIENDO: 'Arriendo', MARKETING: 'Marketing', OTROS: 'Otros',
}

// Get first and last day of current month
function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt  = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

const EMPTY_FORM = { description: '', amount: '', date: new Date().toISOString().slice(0, 10), category: 'OTROS', notes: '' }

export default function ContabilidadPage() {
  const confirm = useConfirm()
  const { from: initFrom, to: initTo } = currentMonthRange()
  const [dateFrom, setDateFrom]   = useState(initFrom)
  const [dateTo, setDateTo]       = useState(initTo)

  const [summary, setSummary]     = useState<AccountingSummary | null>(null)
  const [expenses, setExpenses]   = useState<ExpenseSummary[]>([])
  const [loadingSum, setLoadingSum] = useState(true)
  const [loadingExp, setLoadingExp] = useState(true)

  // New expense form
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  // Delete modal
  const [deleting, setDeleting]   = useState<string | null>(null)

  // Expense list pagination
  const [expPage, setExpPage] = useState(1)
  useEffect(() => { setExpPage(1) }, [dateFrom, dateTo])
  const expTotalPages = Math.ceil(expenses.length / PER_PAGE)
  const pagedExpenses = expenses.slice((expPage - 1) * PER_PAGE, expPage * PER_PAGE)

  const loadSummary = useCallback(async () => {
    setLoadingSum(true)
    const p = new URLSearchParams({ dateFrom, dateTo })
    const res = await fetch(`/api/accounting?${p}`)
    const j = await res.json()
    if (j.success) setSummary(j.data)
    setLoadingSum(false)
  }, [dateFrom, dateTo])

  const loadExpenses = useCallback(async () => {
    setLoadingExp(true)
    const p = new URLSearchParams({ dateFrom, dateTo, limit: '100' })
    const res = await fetch(`/api/expenses?${p}`)
    const j = await res.json()
    if (j.success) setExpenses(j.data.expenses)
    setLoadingExp(false)
  }, [dateFrom, dateTo])

  useEffect(() => { loadSummary(); loadExpenses() }, [loadSummary, loadExpenses])

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaveError('')
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseInt(form.amount) }),
    })
    const j = await res.json()
    setSaving(false)
    if (!j.success) { setSaveError(j.error ?? 'Error al guardar'); return }
    setForm(EMPTY_FORM)
    loadExpenses()
    loadSummary()
  }

  async function deleteExpense(id: string) {
    const ok = await confirm({
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar gasto',
      danger: true,
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setDeleting(null)
    loadExpenses()
    loadSummary()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Finanzas</p>
        <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Contabilidad</h1>
        <p className="text-sm text-ink-muted mt-0.5">Ingresos, gastos y utilidad neta del período</p>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="form-label text-[10px]">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="input-field" />
        </div>
        <div>
          <label className="form-label text-[10px]">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="input-field" />
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Ingresos', value: summary?.totalIncome ?? 0, color: 'text-green-600' },
          { label: 'Gastos',   value: summary?.totalExpenses ?? 0, color: 'text-red-500' },
          { label: 'Utilidad neta', value: summary?.netProfit ?? 0,
            color: (summary?.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: 'Citas cobradas', value: summary?.paidCount ?? 0, isCta: true },
        ].map(({ label, value, color, isCta }) => (
          <div key={label} className="bg-white rounded-xl border border-beige-dark p-4">
            <p className="text-xs text-ink-muted mb-1">{label}</p>
            <p className={`text-xl font-serif font-light ${color ?? 'text-ink'} ${loadingSum ? 'opacity-40' : ''}`}>
              {isCta ? value : COP(value as number)}
            </p>
          </div>
        ))}
      </div>
      {summary && (
        <p className="text-xs text-ink-muted -mt-4 mb-6">
          {summary.paidCount} pagadas · {summary.pendingCount} sin pago · {summary.appointmentCount} total en el período
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Register expense */}
        <div>
          <h2 className="text-lg font-serif text-ink mb-3">Registrar gasto</h2>
          <form onSubmit={addExpense} className="bg-white rounded-xl border border-beige-dark p-5 space-y-3">
            <div>
              <label className="form-label text-[10px]">Descripción *</label>
              <input required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Esmaltes UV, bombillas, etc."
                className="input-field w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label text-[10px]">Monto (COP) *</label>
                <input required type="number" min="1" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className="input-field w-full" />
              </div>
              <div>
                <label className="form-label text-[10px]">Fecha *</label>
                <input required type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="input-field w-full" />
              </div>
            </div>
            <div>
              <label className="form-label text-[10px]">Categoría</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="select-field w-full">
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CAT_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-[10px]">Notas</label>
              <input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Opcional"
                className="input-field w-full" />
            </div>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
            <button type="submit" disabled={saving}
              className="btn-primary w-full disabled:opacity-50">
              {saving ? 'Guardando…' : '+ Registrar gasto'}
            </button>
          </form>
        </div>

        {/* Period expense list */}
        <div>
          <h2 className="text-lg font-serif text-ink mb-3">
            Gastos del período
            <span className="text-sm font-sans text-ink-muted ml-2">({expenses.length})</span>
          </h2>
          {loadingExp ? (
            <p className="text-sm text-ink-muted">Cargando…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-ink-muted">Sin gastos en este período.</p>
          ) : (
            <div className="space-y-2">
              {pagedExpenses.map(exp => (
                <div key={exp.id}
                  className="bg-white rounded-xl border border-beige-dark px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{exp.description}</p>
                    <p className="text-xs text-ink-muted">
                      {CAT_LABEL[exp.category]} ·{' '}
                      {new Date(exp.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </p>
                    {exp.notes && <p className="text-xs text-ink-muted/70 mt-0.5">{exp.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-red-500">{COP(exp.amount)}</p>
                    <button
                      onClick={() => deleteExpense(exp.id)}
                      disabled={deleting === exp.id}
                      className="btn-row-action text-xs text-ink-muted/50 hover:text-red-500 mt-0.5">
                      {deleting === exp.id ? '…' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              ))}
              <Pagination page={expPage} totalPages={expTotalPages} onPage={setExpPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
