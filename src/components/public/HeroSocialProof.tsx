'use client'
// src/components/public/HeroSocialProof.tsx
// Social proof line under the hero CTAs. The client count comes from
// /api/landing-stats (single source of truth) so it never contradicts the
// numbers shown elsewhere on the site.

import { useEffect, useState } from 'react'
import { STUDIO } from '@/lib/config'

export default function HeroSocialProof() {
  const [clientsCount, setClientsCount] = useState(180)

  useEffect(() => {
    fetch('/api/landing-stats')
      .then((r) => r.json())
      .then((j) => { if (j.success && typeof j.data.clientsCount === 'number') setClientsCount(j.data.clientsCount) })
      .catch(() => {})
  }, [])

  return (
    <div className="mt-7 animate-fade-up animation-delay-400">
      <div className="text-gold tracking-[4px] text-sm" aria-hidden>★★★★★</div>
      <p className="text-white/55 text-sm font-light mt-1.5">
        Más de {clientsCount} clientas satisfechas en {STUDIO.city}
      </p>
    </div>
  )
}
