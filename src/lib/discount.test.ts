import { describe, it, expect } from 'vitest'
import { computeDiscountAmount, computeFinalPrice } from './discount'

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
