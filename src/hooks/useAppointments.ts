'use client'
// src/hooks/useAppointments.ts

import { useState, useEffect, useCallback } from 'react'
import type { AppointmentWithService, AppointmentStatus } from '@/types'

interface Filters {
  status?:   string
  dateFrom?: string
  dateTo?:   string
  page?:     number
  limit?:    number
}

interface Pagination {
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

interface UseAppointmentsResult {
  appointments: AppointmentWithService[]
  pagination:   Pagination | null
  loading:      boolean
  error:        string | null
  refetch:      () => void
  updateStatus: (id: string, status: AppointmentStatus) => Promise<boolean>
  updateNotes:  (id: string, notes: string) => Promise<boolean>
}

export function useAppointments(filters: Filters = {}): UseAppointmentsResult {
  const [appointments, setAppointments] = useState<AppointmentWithService[]>([])
  const [pagination, setPagination]     = useState<Pagination | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [trigger, setTrigger]           = useState(0)

  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo)   params.set('dateTo',   filters.dateTo)
    if (filters.page)     params.set('page',      String(filters.page))
    if (filters.limit)    params.set('limit',     String(filters.limit))

    setLoading(true)
    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAppointments(json.data.appointments)
          setPagination(json.data.pagination)
        } else {
          setError(json.error)
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [
    filters.status, filters.dateFrom, filters.dateTo,
    filters.page, filters.limit, trigger,
  ])

  async function updateStatus(id: string, status: AppointmentStatus): Promise<boolean> {
    const res  = await fetch(`/api/appointments/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    const json = await res.json()
    if (json.success) refetch()
    return json.success
  }

  async function updateNotes(id: string, notes: string): Promise<boolean> {
    const res  = await fetch(`/api/appointments/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ notes }),
    })
    const json = await res.json()
    if (json.success) refetch()
    return json.success
  }

  return { appointments, pagination, loading, error, refetch, updateStatus, updateNotes }
}
