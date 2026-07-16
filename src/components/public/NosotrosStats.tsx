'use client'
// src/components/public/NosotrosStats.tsx
// Stat grid for the "Nosotros" section, fed by /api/landing-stats with a
// hardcoded fallback so it never renders empty.

import { useEffect, useState } from 'react'

interface Stats { yearsExperience: number; clientsCount: number; servicesCount: number }

const FALLBACK: Stats = { yearsExperience: 3, clientsCount: 180, servicesCount: 25 }

export default function NosotrosStats() {
  const [s, setS] = useState<Stats>(FALLBACK)

  useEffect(() => {
    fetch('/api/landing-stats')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setS({ yearsExperience: j.data.yearsExperience, clientsCount: j.data.clientsCount, servicesCount: j.data.servicesCount })
      })
      .catch(() => {})
  }, [])

  const items = [
    { value: `+${s.yearsExperience}`, label: 'Años de experiencia'  },
    { value: `+${s.clientsCount}`,    label: 'Personas satisfechas' },
    { value: `+${s.servicesCount}`,   label: 'Servicios disponibles' },
  ]

  return (
    <div className="grid grid-cols-3 gap-6 pt-6 border-t border-beige-dark">
      {items.map((it) => (
        <div key={it.label}>
          <p className="font-serif text-3xl text-gold-dark font-light">{it.value}</p>
          <p className="text-xs text-ink-muted mt-1 leading-tight">{it.label}</p>
        </div>
      ))}
    </div>
  )
}
