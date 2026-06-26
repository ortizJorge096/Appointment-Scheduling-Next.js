import { describe, it, expect } from 'vitest'
import { cn, formatPrice, shortCode, truncate, sleep, toWhatsAppNumber, formatRequestedAt } from './utils'

describe('formatRequestedAt', () => {
  it('labels a timestamp from today as "Hoy HH:mm"', () => {
    expect(formatRequestedAt(new Date())).toMatch(/^Hoy \d{2}:\d{2}$/)
  })

  it('labels a timestamp from yesterday as "Ayer HH:mm"', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(formatRequestedAt(yesterday)).toMatch(/^Ayer \d{2}:\d{2}$/)
  })

  it('labels older timestamps as "d MMM HH:mm" (no Hoy/Ayer)', () => {
    const label = formatRequestedAt('2026-01-15T15:10:00.000Z')
    expect(label).not.toMatch(/Hoy|Ayer/)
    expect(label).toMatch(/\d{1,2} \w+ \d{2}:\d{2}/)
  })
})

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

describe('toWhatsAppNumber', () => {
  it('prepends 57 to a 10-digit Colombian number', () => {
    expect(toWhatsAppNumber('3124567890')).toBe('573124567890')
  })

  it('strips spaces, dashes and parentheses', () => {
    expect(toWhatsAppNumber('312 456-7890')).toBe('573124567890')
    expect(toWhatsAppNumber('(312) 456 7890')).toBe('573124567890')
  })

  it('keeps a number that already has a country code', () => {
    expect(toWhatsAppNumber('+57 312 456 7890')).toBe('573124567890')
    expect(toWhatsAppNumber('573124567890')).toBe('573124567890')
  })

  it('returns null for too-short / empty / nullish input', () => {
    expect(toWhatsAppNumber('123456')).toBeNull()
    expect(toWhatsAppNumber('')).toBeNull()
    expect(toWhatsAppNumber(null)).toBeNull()
    expect(toWhatsAppNumber(undefined)).toBeNull()
  })

  it('returns null for an absurdly long number', () => {
    expect(toWhatsAppNumber('1234567890123456')).toBeNull()
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
