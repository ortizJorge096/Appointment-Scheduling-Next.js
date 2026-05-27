// src/types/index.ts
// Tipos del dominio — valentinajimenez

import type { AppointmentStatus, DayOfWeek } from '@prisma/client'

// ─────────────────────────────────────────
// RE-EXPORT de enums de Prisma
// ─────────────────────────────────────────
export type { AppointmentStatus, DayOfWeek }

// ─────────────────────────────────────────
// DISPONIBILIDAD
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
// CITAS
// ─────────────────────────────────────────

export interface CreateAppointmentInput {
  clientName: string
  clientEmail: string
  clientPhone: string
  serviceId: string
  date: string        // "YYYY-MM-DD"
  startTime: string   // "HH:MM"
  notes?: string
}

export interface AppointmentWithService {
  id: string
  clientName: string
  clientEmail: string
  clientPhone: string
  date: Date
  startTime: string
  endTime: string
  status: AppointmentStatus
  notes: string | null
  confirmationSentAt: Date | null
  reminderSentAt: Date | null
  createdAt: Date
  service: {
    id: string
    name: string
    price: number
    durationMinutes: number
  }
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus
  notes?: string
  date?: string
  startTime?: string
}

// ─────────────────────────────────────────
// SERVICIOS
// ─────────────────────────────────────────

export interface CreateServiceInput {
  name: string
  description?: string
  price: number
  durationMinutes: number
  order?: number
}

export interface UpdateServiceInput extends Partial<CreateServiceInput> {
  isActive?: boolean
}

// ─────────────────────────────────────────
// HORARIOS
// ─────────────────────────────────────────

export interface ScheduleInput {
  dayOfWeek: DayOfWeek
  startTime: string   // "HH:MM"
  endTime: string     // "HH:MM"
  isActive: boolean
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
