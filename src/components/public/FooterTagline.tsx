'use client'
// src/components/public/FooterTagline.tsx
// Footer tagline built from the live category list so it always matches the
// catalog (categories are stored in the DB). Promotions/combo categories are
// excluded — they aren't a service type and read awkwardly in the sentence.

import { useEffect, useState } from 'react'
import { STUDIO } from '@/lib/config'

interface Category { id: string; name: string; slug: string }

// Shown on first paint (and if the fetch fails) so the line is never empty.
const FALLBACK = ['Uñas', 'Pestañas', 'Cejas', 'Corte de Cabello']

const isPromo = (c: Category) => /promo/i.test(c.slug) || /promo/i.test(c.name)

// "Uñas, pestañas, cejas y corte de cabello" — natural Spanish join, lowercased
// after the first word to match the studio's understated tone.
function buildPhrase(names: string[]): string {
  if (names.length === 0) return ''
  const lower = names.map((n) => n.toLowerCase())
  const list =
    lower.length === 1
      ? lower[0]
      : `${lower.slice(0, -1).join(', ')} y ${lower[lower.length - 1]}`
  return list.charAt(0).toUpperCase() + list.slice(1)
}

export default function FooterTagline() {
  const [names, setNames] = useState<string[]>(FALLBACK)

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const list = (json.data as Category[]).filter((c) => !isPromo(c)).map((c) => c.name)
          if (list.length) setNames(list)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <p className="text-white/30 text-xs mt-3 leading-relaxed max-w-[22em]">
      {buildPhrase(names)} en {STUDIO.city}.<br />Agenda tu cita en línea.
    </p>
  )
}
