'use client'
// src/components/public/Testimonios.tsx
// Testimonials are managed in the admin (/admin/testimonios) and stored in the
// DB. This fetches the approved + active ones from GET /api/testimonials. If
// there are none, the whole section is hidden so the landing never shows empty.

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Testimonial {
  id: string
  clientName: string
  initials: string
  type: string
  text: string
  stars: number
  imageUrl: string | null
}

export default function Testimonios() {
  const [items, setItems] = useState<Testimonial[] | null>(null)

  useEffect(() => {
    fetch('/api/testimonials')
      .then((r) => r.json())
      .then((json) => setItems(json.success ? json.data : []))
      .catch(() => setItems([]))
  }, [])

  // Until loaded, and when empty, render nothing — the section simply appears
  // once there are testimonials to show (never an empty section).
  if (!items || items.length === 0) return null

  return (
    <section id="testimonios" className="py-24 bg-ink">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="eyebrow-center text-gold-light">Testimonios</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-white mt-5">
            Lo que dicen <em className="text-gold italic">nuestras clientas</em>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {items.map((t) => (
            <div key={t.id}
              className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-gold/[0.18] rounded-2xl overflow-hidden flex flex-col">
              {t.imageUrl && (
                <div className="relative w-full h-[180px]">
                  <Image
                    src={t.imageUrl}
                    alt={`Trabajo de ${t.clientName}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-7">
                <div className="text-gold-light tracking-[3px] mb-4" aria-hidden>
                  {'★'.repeat(t.stars)}
                </div>
                <p className="text-white/80 text-[15px] leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full
                                   bg-gradient-to-br from-gold-light to-gold text-ink font-serif font-semibold shrink-0">
                    {t.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.clientName}</p>
                    <p className="text-white/50 text-xs">{t.type}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
