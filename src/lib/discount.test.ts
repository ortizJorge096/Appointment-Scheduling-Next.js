import { describe, it, expect } from 'vitest'
import { computeDiscountAmount, computeFinalPrice, computeAppointmentTotal } from './discount'

describe('computeDiscountAmount', () => {
  it('computes a percentage (rounded to the nearest peso)', () => {
    expect(computeDiscountAmount(80000, 'PORCENTAJE', 10)).toBe(8000)
    expect(computeDiscountAmount(100, 'PORCENTAJE', 33)).toBe(33)
  })

  it('uses a fixed amount as-is', () => {
    expect(computeDiscountAmount(80000, 'VALOR_FIJO', 5000)).toBe(5000)
  })

  it('clamps a fixed discount to the subtotal (never exceeds the bill)', () => {
    expect(computeDiscountAmount(50000, 'VALOR_FIJO', 90000)).toBe(50000)
  })

  it('returns 0 for no/zero/negative discount', () => {
    expect(computeDiscountAmount(80000, null, null)).toBe(0)
    expect(computeDiscountAmount(80000, 'PORCENTAJE', 0)).toBe(0)
    expect(computeDiscountAmount(80000, 'VALOR_FIJO', -5)).toBe(0)
  })
})

describe('computeFinalPrice', () => {
  it('subtracts the discount from the subtotal', () => {
    expect(computeFinalPrice(80000, 'PORCENTAJE', 10)).toBe(72000)
    expect(computeFinalPrice(80000, 'VALOR_FIJO', 5000)).toBe(75000)
  })

  it('never goes below 0', () => {
    expect(computeFinalPrice(50000, 'VALOR_FIJO', 90000)).toBe(0)
  })

  it('equals the subtotal when there is no discount', () => {
    expect(computeFinalPrice(80000, null, null)).toBe(80000)
  })
})

describe('computeAppointmentTotal', () => {
  it('no discount: total is services + extras', () => {
    const r = computeAppointmentTotal([{ price: 35000, extras: [5000] }], [2000])
    expect(r.servicesSubtotal).toBe(35000)
    expect(r.extrasTotal).toBe(7000)
    expect(r.discount).toBe(0)
    expect(r.total).toBe(42000)
  })

  it('applies a per-line percentage discount', () => {
    const r = computeAppointmentTotal([{ price: 35000, descuentoTipo: 'PORCENTAJE', descuentoValor: 10 }])
    expect(r.discount).toBe(3500)
    expect(r.total).toBe(31500)
  })

  it('sums per-line discounts across lines; extras still add', () => {
    const r = computeAppointmentTotal(
      [
        { price: 30000, descuentoTipo: 'PORCENTAJE', descuentoValor: 10, extras: [4000] },
        { price: 20000, descuentoTipo: 'VALOR_FIJO', descuentoValor: 5000 },
      ],
      [1000],
    )
    expect(r.servicesSubtotal).toBe(50000)
    expect(r.extrasTotal).toBe(5000)  // 4000 (line) + 1000 (general)
    expect(r.discount).toBe(8000)     // 3000 + 5000
    expect(r.total).toBe(47000)       // 50000 − 8000 + 5000
  })

  it('applies an order-level percentage discount over services + extras', () => {
    const r = computeAppointmentTotal([{ price: 35000, extras: [5000] }], [], { tipo: 'PORCENTAJE', valor: 20 })
    expect(r.discount).toBe(8000)     // 20% of 40000
    expect(r.total).toBe(32000)
  })

  it('applies an order-level fixed discount', () => {
    const r = computeAppointmentTotal([{ price: 35000 }], [], { tipo: 'VALOR_FIJO', valor: 5000 })
    expect(r.total).toBe(30000)
  })

  it('order discount takes precedence and does not double-apply line discounts', () => {
    const r = computeAppointmentTotal(
      [{ price: 35000, descuentoTipo: 'PORCENTAJE', descuentoValor: 50 }],
      [],
      { tipo: 'PORCENTAJE', valor: 10 },
    )
    expect(r.discount).toBe(3500)     // 10% order, NOT the 50% line
    expect(r.total).toBe(31500)
  })

  it('never lets the total go below 0', () => {
    const r = computeAppointmentTotal([{ price: 10000, descuentoTipo: 'VALOR_FIJO', descuentoValor: 999999 }])
    expect(r.total).toBe(0)
  })
})
