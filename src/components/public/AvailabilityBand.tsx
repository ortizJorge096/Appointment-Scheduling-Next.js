'use client'
// src/components/public/AvailabilityBand.tsx
// Slim dark band right below the hero showing the next available slot — the
// studio's key conversion differentiator. Hidden if there's no availability.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface NextSlot {
  date: string
  startTime: string
  service: { name: string }
}

export default function AvailabilityBand() {
  const [slot, setSlot] = useState<NextSlot | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/availability/next')
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data) setSlot(j.data) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Hide the band entirely when there's no upcoming availability.
  if (loaded && !slot) return null

  const dateLabel = slot
    ? (() => {
        const today = new Date().toISOString().slice(0, 10)
        if (slot.date === today) return 'Hoy'
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        if (slot.date === tomorrow) return 'Mañana'
        return format(new Date(`${slot.date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es })
      })()
    : null

  return (
    <section className="bg-ink border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex flex-wrap items-center justify-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 text-sm min-w-0">
          <span className="w-2 h-2 rounded-full bg-gold-light shadow-[0_0_0_4px_rgba(212,173,90,0.18)] animate-pulse shrink-0" />
          <span className="text-white/55">Próxima disponibilidad:</span>
          {slot ? (
            <span className="text-white font-medium truncate first-letter:uppercase">
              {dateLabel} · {slot.service.name} · {slot.startTime}
            </span>
          ) : (
            <span className="text-white/40">consultando…</span>
          )}
        </div>
        <Link href="/agendar" className="btn-cta text-sm shrink-0">Agendar cita</Link>
      </div>
    </section>
  )
}
