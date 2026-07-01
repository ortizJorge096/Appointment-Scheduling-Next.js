'use client'
// src/components/public/Galeria.tsx
// Client component — fetches the public gallery endpoint (GET /api/gallery)
// and falls back to elegant placeholder gradients if nothing has been
// uploaded yet. Moved off direct Prisma access so the home page can be fully
// static (no build-time DB dependency, no per-request SSR) — same pattern
// already used by ServicesGrid and NextAvailability.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'

interface GalleryImage {
  id: string
  url: string
  title: string | null
  description: string | null
  category: { id: string; name: string; slug: string } | null
  focalPoint?: string | null
}

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(145deg,#F2EBD9 0%,#B8932A 60%,#1A1209 100%)',
  'linear-gradient(145deg,#E8DCC4 0%,#D4AD5A 70%,#2A2014 100%)',
  'linear-gradient(145deg,#1A1209 0%,#B8932A 50%,#F2EBD9 100%)',
  'linear-gradient(145deg,#2A2014 0%,#D4AD5A 40%,#E8DCC4 100%)',
  'linear-gradient(145deg,#F5EDDA 0%,#8A6E1E 50%,#1A1209 100%)',
  'linear-gradient(145deg,#1A1209 30%,#B8932A 100%)',
]

const PLACEHOLDER_ITEMS = [
  { label: 'Volumen brasilero',       sub: 'Pestañas · 120 min' },
  { label: 'Acrílico esculpido',      sub: 'Uñas · 120 min'     },
  { label: 'Cejas laminadas',         sub: 'Cejas · 60 min'     },
  { label: 'Lifting de pestañas',     sub: 'Pestañas · 60 min'  },
  { label: 'Manicura semipermanente', sub: 'Uñas · 60 min'      },
  { label: 'Cejas con henna',         sub: 'Cejas · 45 min'     },
]

const MAX_IMAGES = 12

export default function Galeria() {
  const [images, setImages]   = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gallery')
      .then((r) => r.json())
      .then((json) => { if (json.success) setImages(json.data.slice(0, MAX_IMAGES)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const showPlaceholders = !loading && images.length === 0

  // Bento pattern: some pieces take up more space for an elegant mosaic.
  const spanFor = (i: number) => {
    const mod = i % 6
    if (mod === 0) return 'sm:col-span-2 sm:row-span-2'
    if (mod === 3) return 'sm:row-span-2'
    return ''
  }

  return (
    <section id="galeria" className="py-24 bg-beige">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="section-tag justify-center mb-4">Nuestro trabajo</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            El trabajo habla <em className="text-gold italic">por sí solo</em>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[140px] md:auto-rows-[170px] gap-3">
          {loading
            ? [1, 2, 3, 4, 5, 6].map((n, i) => (
                <div key={n} className={`rounded-2xl bg-beige-dark/60 animate-pulse ${spanFor(i)}`} />
              ))
            : showPlaceholders
            ? PLACEHOLDER_ITEMS.map((item, i) => (
                <div key={item.label}
                  className={`relative overflow-hidden rounded-2xl shadow-md group cursor-pointer ${spanFor(i)}`}>
                  <div className="w-full h-full transition-transform duration-500 group-hover:scale-110"
                    style={{ background: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length] }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent
                                  transition-opacity duration-300 flex flex-col justify-end p-5">
                    <p className="logo-script text-gold-light text-2xl leading-none">{item.label}</p>
                    <p className="text-white/70 text-[10px] mt-1.5 tracking-widest uppercase">{item.sub}</p>
                  </div>
                </div>
              ))
            : images.map((img, i) => (
                <div key={img.id}
                  className={`relative overflow-hidden rounded-2xl shadow-sm group cursor-pointer bg-beige-dark ${spanFor(i)}`}>
                  <Image src={img.url}
                    alt={img.title ?? 'Diseño'}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    style={{ objectPosition: img.focalPoint ?? 'center center' }}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent
                                  opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                    {img.title && <p className="font-serif italic text-white text-lg leading-tight">{img.title}</p>}
                    {img.description && <p className="text-white/80 text-xs mt-1 leading-snug">{img.description}</p>}
                    {img.category && <p className="text-gold-light text-xs mt-1.5 tracking-widest uppercase">{img.category.name}</p>}
                  </div>
                </div>
              ))
          }
        </div>

        <p className="text-center text-xs text-ink-muted mt-8 italic">
          Síguenos en{' '}
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"
            className="text-gold hover:underline">
            Instagram
          </a>
          {' '}y{' '}
          <a href={TIKTOK_URL} target="_blank" rel="noreferrer"
            className="text-gold hover:underline">
            TikTok
          </a>
          {' '}para ver todos nuestros trabajos
        </p>
      </div>
    </section>
  )
}
