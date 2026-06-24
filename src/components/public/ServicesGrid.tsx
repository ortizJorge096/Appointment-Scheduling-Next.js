'use client'
// src/components/public/ServicesGrid.tsx
// Category-level cards (Uñas, Pestañas, Cejas, Corte, Promos + VIP), matching
// the prototype's "Servicios" section. Data comes from GET /api/services —
// each card aggregates the active services within its category (price "desde"
// + duration range). Clicking a card jumps to the booking flow pre-filtered
// by that category; the VIP card is a static promo for the multi-service flow.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CategoryIcon } from './ServiceIcons'
import { CATEGORY_ORDER, categoryLabel } from '@/lib/config'
import { formatPrice } from '@/lib/utils'

interface Service {
  id: string
  category: string
  price: number
  durationMinutes: number
  isActive: boolean
}

const CATEGORY_BLURBS: Record<string, string> = {
  UNAS:     'Manicura, pedicura, gel, acrílico y nail art',
  PESTANAS: 'Lifting, extensiones, volumen e híbridas',
  CEJAS:    'Depilación, henna, diseño y laminado',
  CORTE:    'Corte, peinado y diseño de flequillo',
  PROMOS:   'Combos con precio especial',
}

export default function ServicesGrid() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((json) => { if (json.success) setServices(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = CATEGORY_ORDER
    .map((cat) => ({ cat, svcs: services.filter((s) => s.isActive && s.category === cat) }))
    .filter((g) => g.svcs.length > 0)

  return (
    <section id="servicios" className="py-24 bg-beige/20 relative overflow-hidden">
      <div
        className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #B8932A 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-16">
          <span className="eyebrow-center">Servicios</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mt-5">
            Rituales de belleza a tu <em className="text-gold italic">medida</em>
          </h2>
          <p className="text-ink-muted text-sm mt-5 max-w-md mx-auto leading-relaxed">
            Cada servicio incluye consulta personalizada y productos premium.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-[220px] rounded-2xl bg-beige-dark/60 animate-pulse" />
            ))
          ) : (
            <>
              {categories.map(({ cat, svcs }) => {
                const minPrice = Math.min(...svcs.map((s) => s.price))
                const minDur = Math.min(...svcs.map((s) => s.durationMinutes))
                const maxDur = Math.max(...svcs.map((s) => s.durationMinutes))
                const durationLabel = minDur === maxDur ? `${minDur} min` : `${minDur}–${maxDur} min`

                return (
                  <div
                    key={cat}
                    className="group card-premium-hover accent-top p-8 flex flex-col gap-4"
                  >
                    <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-pale text-gold-dark">
                      <CategoryIcon category={cat} className="w-7 h-7" />
                    </span>

                    <div>
                      <h3 className="font-serif text-2xl leading-tight text-ink">
                        {categoryLabel(cat)}
                      </h3>
                      {CATEGORY_BLURBS[cat] && (
                        <p className="text-sm leading-relaxed mt-2 text-ink-muted">
                          {CATEGORY_BLURBS[cat]}
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between pt-4 mt-auto border-t border-beige-dark/60">
                      <div>
                        <p className="font-serif text-xl leading-none text-gold-dark">
                          Desde {formatPrice(minPrice)}
                        </p>
                        <p className="text-[11px] mt-1.5 text-ink-muted">
                          {durationLabel}
                        </p>
                      </div>
                      <Link href={`/agendar?categoria=${cat}`}
                        className="text-xs tracking-widest uppercase font-semibold transition-colors text-gold-dark hover:text-gold">
                        Reservar →
                      </Link>
                    </div>
                  </div>
                )
              })}

              {/* Static VIP promo card — multi-service discount flow, not tied to a real category */}
              <div className="group card-premium-hover accent-top p-8 flex flex-col gap-4 bg-ink text-white">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[rgba(212,173,90,.15)] text-[var(--gold-light)]">
                  <CategoryIcon category="VIP" className="w-7 h-7" />
                </span>

                <div>
                  <h3 className="font-serif text-2xl leading-tight text-white">Paquete VIP</h3>
                  <p className="text-sm leading-relaxed mt-2 text-[#b7ae9c]">
                    Combina servicios y ahorra hasta 30%.
                  </p>
                </div>

                <div className="flex items-end justify-between pt-4 mt-auto border-t border-[rgba(255,255,255,.08)]">
                  <div>
                    <p className="font-serif text-xl leading-none text-[var(--gold-light)]">Personalizado</p>
                    <p className="text-[11px] mt-1.5 text-[#b7ae9c]">Reserva doble</p>
                  </div>
                  <Link href="/agendar"
                    className="text-xs tracking-widest uppercase font-semibold transition-colors text-[var(--gold-light)] hover:text-[var(--gold)]">
                    Reservar →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
