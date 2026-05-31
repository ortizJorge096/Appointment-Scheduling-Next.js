'use client'
// src/hooks/useAvailability.ts

import { useState, useEffect, useCallback } from 'react'
import type { TimeSlot } from '@/types'

interface UseAvailabilityResult {
  slots:           TimeSlot[]
  availableSlots:  TimeSlot[]
  durationMinutes: number
  loading:         boolean
  error:           string | null
  refetch:         () => void
}

export function useAvailability(
  serviceId: string,
  date: string
): UseAvailabilityResult {
  const [slots, setSlots]               = useState<TimeSlot[]>([])
  const [durationMinutes, setDuration]  = useState(0)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [trigger, setTrigger]           = useState(0)

  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  useEffect(() => {
    if (!serviceId || !date) return

    const controller = new AbortController()

    fetch(`/api/availability?date=${date}&serviceId=${serviceId}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setSlots(json.data.slots)
          setDuration(json.data.serviceDuration)
        } else {
          setError(json.error ?? 'Error al cargar disponibilidad')
          setSlots([])
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Error de conexión')
          setSlots([])
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [serviceId, date, trigger])

  return {
    slots,
    availableSlots: slots.filter((s) => s.available),
    durationMinutes,
    loading,
    error,
    refetch,
  }
}
