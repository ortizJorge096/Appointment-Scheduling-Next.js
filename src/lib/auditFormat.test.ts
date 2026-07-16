// src/lib/auditFormat.test.ts
import { formatDiff, formatDiffText, formatValue, fieldLabel } from './auditFormat'

describe('formatValue', () => {
  it('translates enum values into Spanish', () => {
    expect(formatValue('status', 'CONFIRMED')).toBe('Confirmada')
    expect(formatValue('paymentStatus', 'PENDING')).toBe('Sin pago')
    expect(formatValue('paymentMethod', 'EFECTIVO')).toBe('Efectivo')
    expect(formatValue('source', 'ONLINE')).toBe('Web')
  })

  it('renders booleans as Sí/No and money as COP', () => {
    expect(formatValue('isActive', true)).toBe('Sí')
    expect(formatValue('isActive', false)).toBe('No')
    expect(formatValue('amountPaid', 70000)).toContain('70.000')
  })

  it('renders null/empty as an em dash and unknown enums verbatim', () => {
    expect(formatValue('email', null)).toBe('—')
    expect(formatValue('name', '')).toBe('—')
    expect(formatValue('status', 'WEIRD')).toBe('WEIRD') // no crash on unmapped value
  })
})

describe('fieldLabel', () => {
  it('maps known keys and falls back to the raw key', () => {
    expect(fieldLabel('name')).toBe('Nombre')
    expect(fieldLabel('paymentStatus')).toBe('Estado de pago')
    expect(fieldLabel('somethingNew')).toBe('somethingNew')
  })
})

describe('formatDiff', () => {
  it('shows only what changed, omitting nulls and unchanged fields', () => {
    const before = { name: 'Alex Caballeo', email: null, notes: null, phone: '1234567890' }
    const after  = { name: 'Alex Caballero', email: null, notes: null, phone: '1234567890' }
    const diff = formatDiff(before, after, 'UPDATE')
    expect(diff).toHaveLength(1)
    expect(diff[0]).toMatchObject({ label: 'Nombre', kind: 'changed', text: 'Alex Caballeo → Alex Caballero' })
  })

  it('translates enum changes on both sides', () => {
    const diff = formatDiff({ status: 'CONFIRMED', paymentStatus: 'PENDING' }, { status: 'COMPLETED', paymentStatus: 'PAID' }, 'STATUS_CHANGE')
    expect(diff.map((d) => d.text)).toEqual(['Confirmada → Completada', 'Sin pago → Pagado'])
  })

  it('treats a create (only "after") as a set of added fields', () => {
    const diff = formatDiff(null, { clientName: 'Ana', source: 'ONLINE' }, 'CREATE')
    expect(diff).toEqual([
      { label: 'Cliente', kind: 'set', text: 'Ana' },
      { label: 'Origen', kind: 'set', text: 'Web' },
    ])
  })

  it('marks fields dropped in a delete as removed', () => {
    const diff = formatDiff({ status: 'CONFIRMED' }, null, 'DELETE')
    expect(diff[0]).toMatchObject({ label: 'Estado', kind: 'removed', text: 'Confirmada' })
  })

  it('returns an empty diff when nothing meaningful changed', () => {
    expect(formatDiff({ email: null }, { email: null })).toEqual([])
    expect(formatDiff({ phone: '1' }, { phone: '1' })).toEqual([])
  })
})

describe('formatDiffText', () => {
  it('joins the diff into one readable line for the CSV', () => {
    const text = formatDiffText({ name: 'Alex Caballeo' }, { name: 'Alex Caballero' }, 'UPDATE')
    expect(text).toBe('Nombre: Alex Caballeo → Alex Caballero')
  })
})
