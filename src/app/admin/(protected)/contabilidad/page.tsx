'use client'
// src/app/admin/(protected)/contabilidad/page.tsx
// Financial view: appointment revenue + expenses + net profit, enriched with
// period-over-period deltas, outstanding receivables and an expense breakdown.

import { useState, useEffect, useCallback } from 'react'
import type { ExpenseSummary, AccountingSummary } from '@/types'
import { Pagination } from '@/components/admin/Pagination'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePermissionGuard, useCan } from '@/components/admin/usePermissionGuard'
import { PAYMENT_METHOD_LABEL as METHOD_LABEL, EXPENSE_CATEGORY_LABEL as CAT_LABEL } from '@/lib/labels'
import { formatPrice } from '@/lib/utils'
import { useFieldValidation } from '@/hooks/useFieldValidation'
import { SubmitButton } from '@/components/ui/SubmitButton'

const PER_PAGE = 10

const EXPENSE_CATEGORIES = ['INSUMOS', 'EQUIPOS', 'SERVICIOS', 'ARRIENDO', 'MARKETING', 'OTROS'] as const

// Get first and last day of current month
function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt  = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

// Previous window of the SAME length, immediately before `from` — the baseline
// for period-over-period deltas. Robust for any range (week, month, custom).
function previousRange(from: string, to: string) {
  const dayMs    = 86_400_000
  const f        = new Date(`${from}T00:00:00`)
  const t        = new Date(`${to}T00:00:00`)
  const len      = Math.round((t.getTime() - f.getTime()) / dayMs) + 1 // inclusive
  const prevTo   = new Date(f.getTime() - dayMs)
  const prevFrom = new Date(prevTo.getTime() - (len - 1) * dayMs)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(prevFrom), to: fmt(prevTo) }
}

// Percent change vs a baseline; null when there's no baseline to compare against.
function pctDelta(current: number, previous: number): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

// Quote a CSV cell only when it contains a comma, quote or newline.
function csvCell(value: string) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Validated on blur and on submit. Module-level so the hook keeps a stable ref.
const EXPENSE_FIELDS = ['description', 'amount', 'date'] as const

const EMPTY_FORM = { description: '', amount: '', date: new Date().toISOString().slice(0, 10), category: 'OTROS', notes: '' }

// Small period-over-period indicator. For expenses a rise is bad → `invert`
// flips the color semantics so "up" reads red instead of green.
function DeltaBadge({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const d = pctDelta(current, previous)
  if (!d) return <span className="text-[11px] text-ink-muted-deep mt-1 block">— sin período anterior</span>
  const good  = d.dir === 'flat' ? null : invert ? d.dir === 'down' : d.dir === 'up'
  const color = good === null ? 'text-ink-muted-deep' : good ? 'text-green-700' : 'text-red-700'
  const arrow = d.dir === 'up' ? '↑' : d.dir === 'down' ? '↓' : '→'
  return (
    <span className={`text-[11px] mt-1 inline-flex items-center gap-1 ${color}`}>
      <span>{arrow} {Math.abs(d.pct)}%</span>
      <span className="text-ink-muted-deep">vs. anterior</span>
    </span>
  )
}

export default function ContabilidadPage() {
  usePermissionGuard('contabilidad:ver')
  const confirm = useConfirm()
  const can = useCan()
  const { from: initFrom, to: initTo } = currentMonthRange()
  const [dateFrom, setDateFrom]   = useState(initFrom)
  const [dateTo, setDateTo]       = useState(initTo)

  const [summary, setSummary]         = useState<AccountingSummary | null>(null)
  const [prevSummary, setPrevSummary] = useState<AccountingSummary | null>(null)
  const [expenses, setExpenses]   = useState<ExpenseSummary[]>([])
  const [loadingSum, setLoadingSum] = useState(true)
  const [loadingExp, setLoadingExp] = useState(true)

  // New expense form
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  const v = useFieldValidation(EXPENSE_FIELDS, (k) => {
    switch (k) {
      case 'description':
        return form.description.trim() ? undefined : 'La descripción es requerida'
      case 'amount': {
        const n = parseInt(form.amount)
        if (!form.amount.trim()) return 'El monto es requerido'
        return Number.isFinite(n) && n > 0 ? undefined : 'El monto debe ser mayor a 0'
      }
      case 'date':
        return form.date ? undefined : 'La fecha es requerida'
    }
  })

  // Delete modal
  const [deleting, setDeleting]   = useState<string | null>(null)

  // Expense list pagination
  const [expPage, setExpPage] = useState(1)
  useEffect(() => { setExpPage(1) }, [dateFrom, dateTo])
  const expTotalPages = Math.ceil(expenses.length / PER_PAGE)
  const pagedExpenses = expenses.slice((expPage - 1) * PER_PAGE, expPage * PER_PAGE)

  const loadSummary = useCallback(async () => {
    setLoadingSum(true)
    // Fetch the current period and the equal-length previous window in parallel
    // so the cards can show period-over-period deltas.
    const prev = previousRange(dateFrom, dateTo)
    const [curRes, prevRes] = await Promise.all([
      fetch(`/api/accounting?${new URLSearchParams({ dateFrom, dateTo })}`),
      fetch(`/api/accounting?${new URLSearchParams({ dateFrom: prev.from, dateTo: prev.to })}`),
    ])
    const [curJ, prevJ] = await Promise.all([curRes.json(), prevRes.json()])
    if (curJ.success) setSummary(curJ.data)
    setPrevSummary(prevJ.success ? prevJ.data : null)
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
    if (Object.keys(v.validateAll()).length > 0) return
    setSaving(true); setSaveError('')
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseInt(form.amount) }),
    })
    const j = await res.json()
    setSaving(false)
    if (!j.success) { setSaveError(j.error ?? 'Error al guardar'); return }
    setForm(EMPTY_FORM); v.reset()
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

  // Export the period's expenses to CSV, client-side, from the loaded list.
  function exportCsv() {
    const header = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Notas']
    const rows = expenses.map(e => [
      e.date.slice(0, 10),
      e.description,
      CAT_LABEL[e.category] ?? e.category,
      String(e.amount),
      e.notes ?? '',
    ])
    const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
    // BOM so Excel opens the accented UTF-8 correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastos-${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const netColor = (summary?.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
  const receivedTotal = (summary?.incomeByPaymentMethod ?? []).reduce((s, m) => s + m.amount, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Finanzas</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Contabilidad</h1>
          <p className="text-sm text-ink-muted-deep mt-0.5">Ingresos, gastos y utilidad neta del período</p>
        </div>
        {expenses.length > 0 && (
          <button onClick={exportCsv}
            className="shrink-0 min-h-11 inline-flex items-center gap-1.5 px-4 rounded-full border border-beige-dark text-sm text-ink hover:bg-beige/40 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        )}
      </div>

      {/* Date filter */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 mb-6 items-end">
        <div className="min-w-0">
          <label className="form-label text-[10px]">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="input-field w-full min-w-0" />
        </div>
        <div className="min-w-0">
          <label className="form-label text-[10px]">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="input-field w-full min-w-0" />
        </div>
      </div>

      {/* Financial summary — KPIs with period-over-period context */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Ingresos */}
        <div className="bg-white rounded-xl border border-beige-dark p-4">
          <p className="text-xs text-ink-muted-deep mb-1">Ingresos</p>
          <p className={`text-lg sm:text-xl font-serif font-light text-green-700 break-words ${loadingSum ? 'opacity-40' : ''}`}>
            {formatPrice(summary?.totalIncome ?? 0)}
          </p>
          {summary && prevSummary && <DeltaBadge current={summary.totalIncome} previous={prevSummary.totalIncome} />}
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-xl border border-beige-dark p-4">
          <p className="text-xs text-ink-muted-deep mb-1">Gastos</p>
          <p className={`text-lg sm:text-xl font-serif font-light text-red-700 break-words ${loadingSum ? 'opacity-40' : ''}`}>
            {formatPrice(summary?.totalExpenses ?? 0)}
          </p>
          {summary && prevSummary && <DeltaBadge current={summary.totalExpenses} previous={prevSummary.totalExpenses} invert />}
        </div>

        {/* Utilidad neta + margen */}
        <div className="bg-white rounded-xl border border-beige-dark p-4">
          <p className="text-xs text-ink-muted-deep mb-1">Utilidad neta</p>
          <p className={`text-lg sm:text-xl font-serif font-light break-words ${netColor} ${loadingSum ? 'opacity-40' : ''}`}>
            {formatPrice(summary?.netProfit ?? 0)}
          </p>
          <span className="text-[11px] text-ink-muted-deep mt-1 block">margen {summary?.marginPct ?? 0}%</span>
        </div>

        {/* Por cobrar */}
        <div className="bg-white rounded-xl border border-gold/40 p-4">
          <p className="text-xs text-ink-muted-deep mb-1">Por cobrar</p>
          <p className={`text-lg sm:text-xl font-serif font-light text-gold-dark break-words ${loadingSum ? 'opacity-40' : ''}`}>
            {formatPrice(summary?.receivable ?? 0)}
          </p>
          <span className="text-[11px] text-ink-muted-deep mt-1 block">
            {summary?.receivableCount ?? 0} {(summary?.receivableCount ?? 0) === 1 ? 'cita con saldo' : 'citas con saldo'}
          </span>
        </div>
      </div>

      {summary && (
        <p className="text-xs text-ink-muted-deep mb-6">
          {summary.paidCount} pagadas · {summary.pendingCount} sin pago · {summary.appointmentCount} total en el período
        </p>
      )}

      {/* Income breakdown by payment method */}
      {summary && summary.incomeByPaymentMethod.length > 0 && (
        <div className="bg-white rounded-xl border border-beige-dark p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif text-ink">Ingresos por método de pago</h2>
            <span className="text-xs text-ink-muted-deep">Recibido {formatPrice(receivedTotal)}</span>
          </div>
          <div className="space-y-3">
            {summary.incomeByPaymentMethod.map(m => {
              const pct = receivedTotal > 0 ? Math.round((m.amount / receivedTotal) * 100) : 0
              return (
                <div key={m.method} className="flex items-center gap-3">
                  <span className="w-16 sm:w-28 text-xs sm:text-sm text-ink-muted-deep shrink-0">{METHOD_LABEL[m.method] ?? m.method}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-beige overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 sm:w-36 text-right text-xs sm:text-sm text-ink shrink-0">
                    <b className="font-medium">{formatPrice(m.amount)}</b> <span className="text-ink-muted-deep">· {pct}%</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expense breakdown by category */}
      {summary && summary.expensesByCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-beige-dark p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif text-ink">Gastos por categoría</h2>
            <span className="text-xs text-ink-muted-deep">Total {formatPrice(summary.totalExpenses)}</span>
          </div>
          <div className="space-y-3">
            {summary.expensesByCategory.map(c => {
              const pct = summary.totalExpenses > 0 ? Math.round((c.amount / summary.totalExpenses) * 100) : 0
              return (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="w-16 sm:w-24 text-xs sm:text-sm text-ink-muted-deep shrink-0">{CAT_LABEL[c.category] ?? c.category}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-beige overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 sm:w-36 text-right text-xs sm:text-sm text-ink shrink-0">
                    <b className="font-medium">{formatPrice(c.amount)}</b> <span className="text-ink-muted-deep">· {pct}%</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Register expense — only for roles that can edit accounting (contabilidad:editar) */}
        {can('contabilidad:editar') && (
        <div>
          <h2 className="text-lg font-serif text-ink mb-3">Registrar gasto</h2>
          {/* noValidate: `required` alone hands this to the browser's native
              bubble — generic, in the browser's locale, and not on the field.
              Our own errors are inline and match the rest of the admin. */}
          <form onSubmit={addExpense} noValidate className="bg-white rounded-xl border border-beige-dark p-5 space-y-3">
            <div>
              <label htmlFor="gasto-desc" className="form-label text-[10px]">Descripción *</label>
              <input id="gasto-desc" value={form.description}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value })); v.clearError('description') }}
                onBlur={v.handleBlur('description')}
                placeholder="Ej: Esmaltes UV, bombillas, etc."
                className={`input-field w-full ${v.errorOf('description') ? 'border-red-400 focus:ring-red-300' : ''}`} />
              {v.errorOf('description') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('description')}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="gasto-monto" className="form-label text-[10px]">Monto (COP) *</label>
                <input id="gasto-monto" type="number" min="1" value={form.amount}
                  onChange={e => { setForm(f => ({ ...f, amount: e.target.value })); v.clearError('amount') }}
                  onBlur={v.handleBlur('amount')}
                  placeholder="0"
                  className={`input-field w-full min-w-0 ${v.errorOf('amount') ? 'border-red-400 focus:ring-red-300' : ''}`} />
                {v.errorOf('amount') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('amount')}</p>}
              </div>
              <div className="min-w-0">
                <label htmlFor="gasto-fecha" className="form-label text-[10px]">Fecha *</label>
                <input id="gasto-fecha" type="date" value={form.date}
                  onChange={e => { setForm(f => ({ ...f, date: e.target.value })); v.clearError('date') }}
                  onBlur={v.handleBlur('date')}
                  className={`input-field w-full min-w-0 ${v.errorOf('date') ? 'border-red-400 focus:ring-red-300' : ''}`} />
                {v.errorOf('date') && <p className="text-xs text-red-700 mt-0.5">{v.errorOf('date')}</p>}
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
            {saveError && <p className="text-xs text-red-700">{saveError}</p>}
            <SubmitButton type="submit" loading={saving} loadingLabel="Guardando…"
              className="btn-primary w-full disabled:opacity-50">
              + Registrar gasto
            </SubmitButton>
          </form>
        </div>
        )}

        {/* Period expense list */}
        <div>
          <h2 className="text-lg font-serif text-ink mb-3">
            Gastos del período
            <span className="text-sm font-sans text-ink-muted-deep ml-2">({expenses.length})</span>
          </h2>
          {loadingExp ? (
            <p className="text-sm text-ink-muted-deep">Cargando…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-ink-muted-deep">Sin gastos en este período.</p>
          ) : (
            <div className="space-y-2">
              {pagedExpenses.map(exp => (
                <div key={exp.id}
                  className="bg-white rounded-xl border border-beige-dark px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{exp.description}</p>
                    <p className="text-xs text-ink-muted-deep">
                      {CAT_LABEL[exp.category]} ·{' '}
                      {new Date(exp.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </p>
                    {exp.notes && <p className="text-xs text-ink-muted-deep mt-0.5">{exp.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-red-700">{formatPrice(exp.amount)}</p>
                    {can('contabilidad:editar') && (
                      <button
                        onClick={() => deleteExpense(exp.id)}
                        disabled={deleting === exp.id}
                        className="btn-row-action text-xs text-ink-muted-deep hover:text-red-700 mt-0.5">
                        {deleting === exp.id ? '…' : 'Eliminar'}
                      </button>
                    )}
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
