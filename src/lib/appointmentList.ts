// src/lib/appointmentList.ts
// Pure query-builder for the admin appointments list, shared by the SSR page
// (first render) and GET /api/appointments (client-driven filtering). Kept free
// of Prisma client / clock so it's fully unit-testable — inject `today`.

import type { Prisma } from '@prisma/client'

// Ordering options (kept in the URL so they persist + are shareable).
export const SORT_OPTIONS = ['upcoming', 'recent', 'oldest', 'status'] as const
export type Sort = (typeof SORT_OPTIONS)[number]

// Time window — DECOUPLED from ordering so past appointments are reachable
// explicitly (Próximas / Pasadas / Todas) instead of via a sort side-effect.
export const SCOPE_OPTIONS = ['upcoming', 'past', 'all'] as const
export type Scope = (typeof SCOPE_OPTIONS)[number]

// Provenance filter — mirrors the AppointmentOrigin enum.
export const ORIGIN_OPTIONS = ['PUBLIC', 'MANUAL', 'VIP', 'PAST'] as const
export type Origin = (typeof ORIGIN_OPTIONS)[number]

// Payment-status filter — 'pending' groups PENDING+PARTIAL (still owes); the exact
// PaymentStatus values are accepted too.
export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'WAIVED'] as const

// Payment-method filter — mirrors the PaymentMethod enum. Answers "which
// appointments were charged through X", and combines with the other filters
// (e.g. Nequi + this month, or Nequi + already paid).
export const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'NEQUI', 'DAVIPLATA'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const
type KnownStatus = (typeof APPOINTMENT_STATUSES)[number]

const ORDER_BY: Record<Sort, Prisma.AppointmentOrderByWithRelationInput[]> = {
  upcoming: [{ date: 'asc'  }, { startTime: 'asc' }],
  recent:   [{ createdAt: 'desc' }],
  oldest:   [{ createdAt: 'asc'  }],
  status:   [{ status: 'asc' }, { date: 'asc' }, { startTime: 'asc' }],
}

// "Pasadas" with no explicit sort → most-recent history first.
const PAST_DEFAULT_ORDER: Prisma.AppointmentOrderByWithRelationInput[] = [
  { date: 'desc' }, { startTime: 'desc' },
]

export function normalizeSort(sort?: string): Sort {
  return SORT_OPTIONS.includes(sort as Sort) ? (sort as Sort) : 'upcoming'
}

export function normalizeScope(scope?: string): Scope {
  return SCOPE_OPTIONS.includes(scope as Scope) ? (scope as Scope) : 'upcoming'
}

export function normalizeOrigin(origin?: string): Origin | undefined {
  return ORIGIN_OPTIONS.includes(origin as Origin) ? (origin as Origin) : undefined
}

export interface CitasQueryParams {
  status?: string
  scope?: string
  origin?: string
  /** Payment filter. 'pending' = still owes (PENDING/PARTIAL); or an exact PaymentStatus. */
  payment?: string
  /** Exact PaymentMethod. Appointments with no method recorded never match. */
  paymentMethod?: string
  /** Free text: client name, service name, or code (id prefix). */
  search?: string
  serviceId?: string
  categoryId?: string
  /** Value range over amountPaid (rows with null amountPaid don't match). */
  amountMin?: number
  amountMax?: number
  dateFrom?: string
  dateTo?: string
  sort?: string
  /** Whether `sort` was explicitly set (drives the past-scope default ordering). */
  sortExplicit?: boolean
  /** Business "today" as yyyy-MM-dd — the caller resolves the timezone. */
  today: string
}

export interface CitasQuery {
  where: Prisma.AppointmentWhereInput
  orderBy: Prisma.AppointmentOrderByWithRelationInput[]
  scope: Scope
  sort: Sort
}

export function buildAppointmentListQuery(params: CitasQueryParams): CitasQuery {
  const { status, dateFrom, dateTo, today, serviceId, categoryId, amountMin, amountMax } = params
  const scope  = normalizeScope(params.scope)
  const sort   = normalizeSort(params.sort)
  const origin = normalizeOrigin(params.origin)
  const search = params.search?.trim()

  const where: Prisma.AppointmentWhereInput = {}

  if (status && status !== 'ALL' && (APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
    where.status = status as KnownStatus
  }

  if (origin) where.origin = origin

  // Payment filter. 'pending' = still owes (PENDING or PARTIAL); an exact
  // PaymentStatus value narrows to just that one.
  if (params.payment === 'pending') {
    where.paymentStatus = { in: ['PENDING', 'PARTIAL'] }
    // "Still owes" only applies to a booking that happened or is going to: a
    // cancelled or no-show appointment owes nothing. This mirrors the dashboard's
    // "Por cobrar" KPI (which sums over CONFIRMED/COMPLETED), so the card and this
    // list show the same set. An explicit status filter from the user still wins.
    if (!where.status) where.status = { in: ['CONFIRMED', 'COMPLETED'] }
  } else if (params.payment && (PAYMENT_STATUSES as readonly string[]).includes(params.payment)) {
    where.paymentStatus = params.payment as (typeof PAYMENT_STATUSES)[number]
  }

  // Payment method — exact match, independent of the payment STATUS filter, so they
  // compose (e.g. "paid with Nequi" = paymentMethod=NEQUI + payment=PAID). An
  // appointment with no method recorded never matches a method filter.
  if (params.paymentMethod && (PAYMENT_METHODS as readonly string[]).includes(params.paymentMethod)) {
    where.paymentMethod = params.paymentMethod as PaymentMethod
  }

  // Date window. An explicit range always wins over the scope window.
  const todayStart = new Date(`${today}T00:00:00`)
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
    }
  } else if (scope === 'upcoming') {
    where.date = { gte: todayStart }
  } else if (scope === 'past') {
    where.date = { lt: todayStart }
  }

  // Value range over the real money charged (amountPaid). Null (unpaid) rows are
  // excluded by Prisma's numeric filter — intended: value filters target charges.
  if (amountMin != null || amountMax != null) {
    where.amountPaid = {
      ...(amountMin != null ? { gte: amountMin } : {}),
      ...(amountMax != null ? { lte: amountMax } : {}),
    }
  }

  // Service / category — matched across the appointment's services (the primary
  // service is always included in the `services` relation), so multi-service
  // bookings are caught too.
  if (serviceId || categoryId) {
    where.services = {
      some: {
        ...(serviceId  ? { serviceId } : {}),
        ...(categoryId ? { service: { categoryId } } : {}),
      },
    }
  }

  // Free-text search: client name, service name (primary + snapshots), or the
  // appointment code (first chars of the id, shown uppercased in the detail).
  if (search) {
    where.OR = [
      { clientName: { contains: search, mode: 'insensitive' } },
      { service:  { name: { contains: search, mode: 'insensitive' } } },
      { services: { some: { serviceName: { contains: search, mode: 'insensitive' } } } },
      { id: { startsWith: search.toLowerCase() } },
    ]
  }

  // Ordering: explicit sort wins; otherwise "Pasadas" defaults to recent-first.
  const orderBy = params.sortExplicit
    ? ORDER_BY[sort]
    : scope === 'past'
      ? PAST_DEFAULT_ORDER
      : ORDER_BY[sort]

  return { where, orderBy, scope, sort }
}
