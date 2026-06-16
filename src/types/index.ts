// src/types/index.ts
// Domain types — valentinajimenez

import type { AppointmentStatus, DayOfWeek, ServiceCategory } from '@prisma/client'

// ─────────────────────────────────────────
// RE-EXPORT of existing Prisma enums
// ─────────────────────────────────────────
export type { AppointmentStatus, DayOfWeek, ServiceCategory }

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
  serviceId: string
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
  date: string        // "YYYY-MM-DD"
  startTime: string   // "HH:MM"
  notes?: string
  source?: AppointmentSource
  skipAvailabilityCheck?: boolean
}

export interface AppointmentWithService {
  id: string
  clientName: string
  clientEmail: string
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
  notes: string | null
  cancelToken?: string | null
  calendarEventId?: string | null
  confirmationSentAt: string | null
  reminderSentAt: string | null
  createdAt: string
  service: {
    id: string
    name: string
    price: number
    durationMinutes: number
  }
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

export interface CreateServiceInput {
  name: string
  description?: string
  category?: ServiceCategory
  price: number
  durationMinutes: number
  order?: number
}

export interface PublicService {
  id: string
  name: string
  description: string | null
  category: ServiceCategory
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

export interface AccountingSummary {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  appointmentCount: number
  paidCount: number
  pendingCount: number
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
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
