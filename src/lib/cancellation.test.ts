import { isWithinCancelWindow, CANCEL_LIMIT_HOURS } from './cancellation'

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

describe('isWithinCancelWindow', () => {
  it('CANCEL_LIMIT_HOURS is 24', () => {
    expect(CANCEL_LIMIT_HOURS).toBe(24)
  })

  it('is true for an appointment several days ahead', () => {
    expect(isWithinCancelWindow(daysFromNow(10), '12:00')).toBe(true)
  })

  it('is false for an appointment in the past', () => {
    expect(isWithinCancelWindow(daysFromNow(-2), '12:00')).toBe(false)
  })

  it('is false for an appointment only a few hours away (within 24h)', () => {
    // ~3h from now, well inside the 24h window
    const soon = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const hh = String(soon.getHours()).padStart(2, '0')
    const mm = String(soon.getMinutes()).padStart(2, '0')
    expect(isWithinCancelWindow(soon, `${hh}:${mm}`)).toBe(false)
  })
})
