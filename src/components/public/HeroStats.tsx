'use client'
// src/components/public/HeroStats.tsx
// Hero stat bar, fed by /api/landing-stats. Falls back to sane defaults so the
// hero never renders empty if the request is slow or fails.

import { useEffect, useState } from 'react'

interface Stats { appointmentsCount: number; rating: number; servicesCount: number }

const FALLBACK: Stats = { appointmentsCount: 300, rating: 4.8, servicesCount: 25 }

export default function HeroStats() {
  const [s, setS] = useState<Stats>(FALLBACK)

  useEffect(() => {
    fetch('/api/landing-stats')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setS({ appointmentsCount: j.data.appointmentsCount, rating: j.data.rating, servicesCount: j.data.servicesCount })
      })
      .catch(() => {})
  }, [])

  const items = [
    { value: `+${s.appointmentsCount}`, label: 'Citas realizadas' },
    { value: `${s.rating}★`,            label: 'Calificación'     },
    { value: `+${s.servicesCount}`,     label: 'Servicios'        },
  ]

  return (
    <div className="flex gap-6 flex-wrap mt-7 animate-fade-up animation-delay-400">
      {items.map((it) => (
        <div key={it.label} className="text-[13px] text-white/55">
          <p className="font-serif text-2xl text-gold font-light leading-none">{it.value}</p>
          {it.label}
        </div>
      ))}
    </div>
  )
}
