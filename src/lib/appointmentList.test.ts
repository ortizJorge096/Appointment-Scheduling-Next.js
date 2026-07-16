// src/lib/appointmentList.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildAppointmentListQuery,
  normalizeScope, normalizeSort, normalizeOrigin,
} from './appointmentList'

const TODAY = '2026-06-30'

describe('buildAppointmentListQuery — scope & sort', () => {
  it('default scope (upcoming) hides everything before today', () => {
    const { where, scope } = buildAppointmentListQuery({ today: TODAY })
    expect(scope).toBe('upcoming')
    expect(where.date).toEqual({ gte: new Date('2026-06-30T00:00:00') })
  })

  it('scope=past shows only past dates and orders most-recent-first by default', () => {
    const { where, orderBy } = buildAppointmentListQuery({ scope: 'past', today: TODAY })
    expect(where.date).toEqual({ lt: new Date('2026-06-30T00:00:00') })
    expect(orderBy).toEqual([{ date: 'desc' }, { startTime: 'desc' }])
  })

  it('scope=all applies no date filter', () => {
    expect(buildAppointmentListQuery({ scope: 'all', today: TODAY }).where.date).toBeUndefined()
  })

  it('an explicit date range overrides the scope window', () => {
    const { where } = buildAppointmentListQuery({
      scope: 'upcoming', dateFrom: '2026-06-01', dateTo: '2026-06-15', today: TODAY,
    })
    expect(where.date).toEqual({
      gte: new Date('2026-06-01T00:00:00'),
      lte: new Date('2026-06-15T23:59:59'),
    })
  })

  it('explicit sort wins over the past-scope default ordering', () => {
    const { orderBy } = buildAppointmentListQuery({
      scope: 'past', sort: 'oldest', sortExplicit: true, today: TODAY,
    })
    expect(orderBy).toEqual([{ createdAt: 'asc' }])
  })
})

describe('buildAppointmentListQuery — status & origin', () => {
  it('applies a valid status and ignores "ALL" / unknown', () => {
    expect(buildAppointmentListQuery({ status: 'COMPLETED', today: TODAY }).where.status).toBe('COMPLETED')
    expect(buildAppointmentListQuery({ status: 'ALL', today: TODAY }).where.status).toBeUndefined()
    expect(buildAppointmentListQuery({ status: 'BOGUS', today: TODAY }).where.status).toBeUndefined()
  })

  it('applies a valid origin and ignores unknown', () => {
    expect(buildAppointmentListQuery({ origin: 'VIP', today: TODAY }).where.origin).toBe('VIP')
    expect(buildAppointmentListQuery({ origin: 'xxx', today: TODAY }).where.origin).toBeUndefined()
  })
})

describe('buildAppointmentListQuery — payment', () => {
  it("'pending' matches PENDING or PARTIAL (still owes)", () => {
    expect(buildAppointmentListQuery({ payment: 'pending', today: TODAY }).where.paymentStatus)
      .toEqual({ in: ['PENDING', 'PARTIAL'] })
  })

  it('an exact PaymentStatus narrows to just that one', () => {
    expect(buildAppointmentListQuery({ payment: 'PAID', today: TODAY }).where.paymentStatus).toBe('PAID')
  })

  it('ignores an unknown or absent payment value', () => {
    expect(buildAppointmentListQuery({ payment: 'xxx', today: TODAY }).where.paymentStatus).toBeUndefined()
    expect(buildAppointmentListQuery({ today: TODAY }).where.paymentStatus).toBeUndefined()
  })
})

describe('buildAppointmentListQuery — value range', () => {
  it('builds a gte/lte amountPaid filter', () => {
    expect(buildAppointmentListQuery({ amountMin: 50000, amountMax: 100000, today: TODAY }).where.amountPaid)
      .toEqual({ gte: 50000, lte: 100000 })
  })

  it('supports a single bound and finds cortesías ($0)', () => {
    expect(buildAppointmentListQuery({ amountMin: 80000, today: TODAY }).where.amountPaid).toEqual({ gte: 80000 })
    expect(buildAppointmentListQuery({ amountMin: 0, amountMax: 0, today: TODAY }).where.amountPaid).toEqual({ gte: 0, lte: 0 })
  })

  it('no value filter when both bounds are absent', () => {
    expect(buildAppointmentListQuery({ today: TODAY }).where.amountPaid).toBeUndefined()
  })
})

describe('buildAppointmentListQuery — service / category', () => {
  it('matches by serviceId across the services relation', () => {
    expect(buildAppointmentListQuery({ serviceId: 'svc1', today: TODAY }).where.services)
      .toEqual({ some: { serviceId: 'svc1' } })
  })

  it('matches by categoryId', () => {
    expect(buildAppointmentListQuery({ categoryId: 'cat1', today: TODAY }).where.services)
      .toEqual({ some: { service: { categoryId: 'cat1' } } })
  })
})

describe('buildAppointmentListQuery — free-text search', () => {
  it('searches client name, service names and the code (id prefix, lowercased)', () => {
    const { where } = buildAppointmentListQuery({ search: 'CMQRF', today: TODAY })
    expect(where.OR).toEqual([
      { clientName: { contains: 'CMQRF', mode: 'insensitive' } },
      { service:  { name: { contains: 'CMQRF', mode: 'insensitive' } } },
      { services: { some: { serviceName: { contains: 'CMQRF', mode: 'insensitive' } } } },
      { id: { startsWith: 'cmqrf' } },
    ])
  })

  it('ignores blank search', () => {
    expect(buildAppointmentListQuery({ search: '   ', today: TODAY }).where.OR).toBeUndefined()
  })
})

describe('normalizers', () => {
  it('fall back to defaults on unknown input', () => {
    expect(normalizeScope('xxx')).toBe('upcoming')
    expect(normalizeSort('xxx')).toBe('upcoming')
    expect(normalizeOrigin('xxx')).toBeUndefined()
    expect(normalizeOrigin('MANUAL')).toBe('MANUAL')
  })
})
