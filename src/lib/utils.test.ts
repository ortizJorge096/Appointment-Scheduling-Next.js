import { describe, it, expect } from 'vitest'
import { cn, formatPrice, shortCode, truncate, sleep } from './utils'

describe('cn', () => {
  it('combines class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('filters falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('formatPrice', () => {
  it('formats in COP', () => {
    const result = formatPrice(50000)
    expect(result).toContain('50')
    expect(result).toContain('000')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toContain('0')
  })
})

describe('shortCode', () => {
  it('returns first 8 chars uppercase', () => {
    expect(shortCode('abc123xyz')).toBe('ABC123XY')
  })

  it('handles short strings', () => {
    expect(shortCode('ab')).toBe('AB')
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello...')
  })

  it('keeps short strings', () => {
    expect(truncate('hi', 5)).toBe('hi')
  })
})

describe('sleep', () => {
  it('resolves after given ms', async () => {
    const start = Date.now()
    await sleep(10)
    expect(Date.now() - start).toBeGreaterThanOrEqual(5)
  })
})
