// src/types/index.ts
// Domain types — valentinajimenez

import type { AppointmentStatus, DayOfWeek } from '@prisma/client'

// ─────────────────────────────────────────
// RE-EXPORT of existing Prisma enums
// ─────────────────────────────────────────
export type { AppointmentStatus, DayOfWeek }

// ─────────────────────────────────────────
// NEW ENUMS (string unions until prisma generate runs)
// Prisma generates the real types; these serve as a contract in TS.
// ─────────────────────────────────────────
export type AppointmentSource = 'ONLINE' | 'WHATSAPP' | 'TELEFONO' | 'PRESENCIAL'
export type PaymentStatus     = 'PENDING' | 'PAID' | 'PARTIAL' | 'WAIVED'
export type PaymentMethod     = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'NEQUI' | 'DAVIPLATA'
export type ExpenseCategory   = 'INSUMOS' | 'EQUIPOS' | 'SERVICIOS' | 'ARRIENDO' | 'MARKETING' | 'OTROS'

// ─────────────────────────────────────────
// AVAILABILITY
// ─────────────────────────────────────────

export interface TimeSlot {
  startTime: string   // "10:00"
  endTime: string     // "10:45"
  available: boolean
}

export interface AvailabilityQuery {
  date: string        // "YYYY-MM-DD"
  serviceId?: string
  durationMinutes?: number
}

export interface AvailabilityResponse {
  date: string
  slots: TimeSlot[]
  serviceDuration: number
}

// ─────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────

export interface ClientSummary {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  createdAt: string
  deletedAt: string | null
  _count: { appointments: number }
}

export interface ClientWithHistory {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  createdAt: string
  appointments: AppointmentWithService[]
}

// ─────────────────────────────────────────
// APPOINTMENTS
// ─────────────────────────────────────────

export interface CreateAppointmentInput {
  clientName: string
  clientEmail: string
  clientPhone: string
  serviceId: string
  serviceIds?: string[]
  totalDurationMinutes?: number
  professionalId?: string | null
  date: string        // "YYYY-MM-DD"
  startTime: string   // "HH:MM"
  notes?: string
  source?: AppointmentSource
  skipAvailabilityCheck?: boolean
}

export interface AppointmentWithService {
  id: string
  clientName: string
  clientEmail: string | null
  clientPhone: string
  clientId: string | null
  date: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  source: AppointmentSource
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod | null
  amountPaid: number | null
  extras?: Array<{ id: string; description: string; amount: number; appointmentServiceId?: string | null }>
  descuentoTipo?: 'PORCENTAJE' | 'VALOR_FIJO' | null
  descuentoValor?: number | null
  descuentoMotivo?: string | null
  precioFinal?: number | null
  notes: string | null
  cancelToken?: string | null
  calendarEventId?: string | null
  confirmationSentAt: string | null
  reminderSentAt: string | null
  reminder2hSentAt?: string | null
  followUpSentAt?: string | null
  createdAt: string
  totalDurationMinutes: number
  discountPercent: number
  service: {
    id: string
    name: string
    price: number
    durationMinutes: number
  }
  services?: Array<{
    id: string
    serviceId: string
    price: number
    descuentoTipo?: 'PORCENTAJE' | 'VALOR_FIJO' | null
    descuentoValor?: number | null
    descuentoMotivo?: string | null
    service: {
      id: string
      name: string
      price: number
      durationMinutes: number
    }
  }>
  professionalId?: string | null
  professional?: { id: string; name: string } | null
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus
  paymentStatus?: PaymentStatus
  paymentMethod?: PaymentMethod | null
  amountPaid?: number | null
  notes?: string
  date?: string
  startTime?: string
}

// ─────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────

export interface CategorySummary {
  id: string
  name: string
  slug: string
  icon: string
}

export interface CreateServiceInput {
  name: string
  description?: string
  categoryId: string
  price: number
  durationMinutes: number
  order?: number
}

export interface PublicService {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  category: CategorySummary | null
  price: number
  durationMinutes: number
  order: number
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
  isActive?: boolean
}

// ─────────────────────────────────────────
// SCHEDULES
// ─────────────────────────────────────────

export interface ScheduleInput {
  dayOfWeek: DayOfWeek
  startTime: string   // "HH:MM"
  endTime: string     // "HH:MM"
  isActive: boolean
}

// ─────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────

export interface ExpenseSummary {
  id: string
  description: string
  amount: number
  date: string
  category: ExpenseCategory
  notes: string | null
  createdAt: string
}

export interface QuickSaleSummary {
  id: string
  description: string
  amount: number
  date: string
  paymentMethod: string | null
  serviceId: string | null
  notes: string | null
  createdAt: string
}

export interface CreateExpenseInput {
  description: string
  amount: number
  date: string        // "YYYY-MM-DD"
  category?: ExpenseCategory
  notes?: string
}

// ─────────────────────────────────────────
// ACCOUNTING
// ─────────────────────────────────────────

export interface CategoryBreakdown {
  category: ExpenseCategory
  amount: number
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod | 'SIN_REGISTRAR'
  amount: number
}

export interface AccountingSummary {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  marginPct: number           // net profit as % of income (0 when no income)
  appointmentCount: number
  paidCount: number
  pendingCount: number
  receivable: number          // outstanding amount still owed (PENDING + PARTIAL balance)
  receivableCount: number     // appointments with an outstanding balance
  quickSaleTotal: number      // income from walk-in quick sales (no client/appointment)
  expensesByCategory: CategoryBreakdown[]
  incomeByPaymentMethod: PaymentMethodBreakdown[]
}

// ─────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: string
  /** Optional machine-readable code so the client can branch on a specific error (e.g. 'CLIENT_INACTIVE'). */
  code?: string
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
