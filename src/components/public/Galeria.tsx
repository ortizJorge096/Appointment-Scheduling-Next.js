'use client'
// src/components/public/Galeria.tsx
// Public portfolio gallery — masonry (CSS columns) + category filters + a
// dependency-free lightbox (React portal). Fetches GET /api/gallery so the home
// page stays fully static; falls back to elegant placeholder gradients when the
// studio hasn't uploaded anything yet.
//
// Note: masonry shows each photo at its real aspect ratio (no crop), so the
// per-image focal point isn't applied here — it only matters when cropping.

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'

interface GalleryImage {
  id: string
  url: string
  title: string | null
  description: string | null
  category: { id: string; name: string; slug: string } | null
  width?: number | null
  height?: number | null
}

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(145deg,var(--beige) 0%,var(--gold) 60%,var(--ink) 100%)',
  'linear-gradient(145deg,var(--beige-dark) 0%,var(--gold-light) 70%,var(--ink-soft) 100%)',
  'linear-gradient(145deg,var(--ink) 0%,var(--gold) 50%,var(--beige) 100%)',
  'linear-gradient(145deg,var(--ink-soft) 0%,var(--gold-light) 40%,var(--beige-dark) 100%)',
  'linear-gradient(145deg,var(--gold-pale) 0%,var(--gold-dark) 50%,var(--ink) 100%)',
  'linear-gradient(145deg,var(--ink) 30%,var(--gold) 100%)',
]

const PLACEHOLDER_ITEMS = [
  { label: 'Volumen brasilero',       sub: 'Pestañas · 120 min', h: 'h-72' },
  { label: 'Acrílico esculpido',      sub: 'Uñas · 120 min',     h: 'h-52' },
  { label: 'Cejas laminadas',         sub: 'Cejas · 60 min',     h: 'h-60' },
  { label: 'Lifting de pestañas',     sub: 'Pestañas · 60 min',  h: 'h-52' },
  { label: 'Manicura semipermanente', sub: 'Uñas · 60 min',      h: 'h-72' },
  { label: 'Cejas con henna',         sub: 'Cejas · 45 min',     h: 'h-60' },
]

const SKELETON_HEIGHTS = ['h-56', 'h-72', 'h-48', 'h-64', 'h-52', 'h-72', 'h-60', 'h-48']
const PAGE_SIZE = 12

// Expand / magnify glyph shown centered on hover.
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M11 8v6M8 11h6M20 20l-4.3-4.3" />
    </svg>
  )
}

export default function Galeria() {
  const [images, setImages]   = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string>('all')
  const [visible, setVisible]     = useState(PAGE_SIZE)
  const [lightbox, setLightbox]   = useState<number | null>(null)
  // Real aspect ratio (w/h) per image, discovered on load — the DB doesn't store
  // dimensions, so this keeps masonry from distorting anything.
  const [aspects, setAspects]     = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/gallery')
      .then((r) => r.json())
      .then((json) => { if (json.success) setImages(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Filter chips are derived from the categories actually present — never hardcoded.
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const img of images) if (img.category) map.set(img.category.slug, img.category.name)
    return Array.from(map, ([slug, name]) => ({ slug, name }))
  }, [images])

  const filtered = useMemo(
    () => (activeCat === 'all' ? images : images.filter((i) => i.category?.slug === activeCat)),
    [images, activeCat],
  )
  const shown = filtered.slice(0, visible)

  useEffect(() => { setVisible(PAGE_SIZE) }, [activeCat])

  const showPlaceholders = !loading && images.length === 0

  const close = useCallback(() => setLightbox(null), [])
  const go = useCallback(
    (dir: number) => setLightbox((idx) => (idx === null ? idx : (idx + dir + filtered.length) % filtered.length)),
    [filtered.length],
  )

  // Lightbox: keyboard nav + lock body scroll while open.
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [lightbox, close, go])

  return (
    <section id="galeria" className="py-24 bg-beige">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-10">
          <span className="section-tag justify-center mb-4">Nuestro trabajo</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            El trabajo habla <em className="text-gold-dark italic">por sí solo</em>
          </h2>
        </div>

        {/* Category filters — horizontal scroll on mobile, centered on desktop */}
        {!loading && !showPlaceholders && categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-8 -mx-6 px-6 sm:mx-0 sm:px-0 sm:justify-center
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>Todos</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c.slug} active={activeCat === c.slug} onClick={() => setActiveCat(c.slug)}>
                {c.name}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Grid — CSS columns masonry (2 cols mobile, 3 desktop; 1 under 380px) */}
        {loading ? (
          <div className="max-[380px]:columns-1 columns-2 lg:columns-3 gap-x-3">
            {SKELETON_HEIGHTS.map((h, i) => (
              <div key={i} className={`mb-3 break-inside-avoid rounded-[10px] bg-beige-dark/60 animate-pulse ${h}`} />
            ))}
          </div>
        ) : showPlaceholders ? (
          <div className="max-[380px]:columns-1 columns-2 lg:columns-3 gap-x-3">
            {PLACEHOLDER_ITEMS.map((item, i) => (
              <div key={item.label}
                className={`mb-3 break-inside-avoid relative overflow-hidden rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${item.h}`}>
                <div className="w-full h-full" style={{ background: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length] }} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent flex flex-col justify-end p-5">
                  <p className="logo-script text-gold-light text-2xl leading-none">{item.label}</p>
                  <p className="text-white/70 text-2xs mt-1.5 tracking-widest uppercase">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div key={activeCat} className="max-[380px]:columns-1 columns-2 lg:columns-3 gap-x-3 animate-fade-in">
              {shown.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightbox(i)}
                  aria-label={img.title ? `Ampliar: ${img.title}` : 'Ampliar imagen'}
                  style={{ aspectRatio: aspects[img.id] ?? 0.8 }}
                  className="mb-3 break-inside-avoid group relative block w-full overflow-hidden rounded-[10px]
                             bg-beige-dark shadow-[0_2px_8px_rgba(0,0,0,0.08)] cursor-pointer"
                >
                  <Image
                    src={img.url}
                    alt={img.title ?? 'Diseño'}
                    fill
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    onLoad={(e) => {
                      const t = e.currentTarget
                      if (t.naturalWidth && t.naturalHeight)
                        setAspects((a) => (a[img.id] ? a : { ...a, [img.id]: t.naturalWidth / t.naturalHeight }))
                    }}
                    className="object-cover"
                  />
                  {/* Hover — dark wash + centered magnifier, no text (the photo speaks). */}
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/30 transition-colors duration-200">
                    <span className="text-gold-light opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                      <ExpandIcon />
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {filtered.length > visible && (
              <div className="text-center mt-10">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="inline-flex items-center px-6 py-2.5 rounded-full border border-gold-deep text-gold-deep
                             text-xs tracking-widest uppercase hover:bg-gold hover:text-ink transition-colors"
                >
                  Ver más
                </button>
              </div>
            )}
          </>
        )}

        <p className="text-center text-sm text-ink-muted mt-14 font-sans">
          Síguenos en{' '}
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-gold-deep hover:underline underline-offset-2">Instagram</a>
          {' '}y{' '}
          <a href={TIKTOK_URL} target="_blank" rel="noreferrer" className="text-gold-deep hover:underline underline-offset-2">TikTok</a>
          {' '}para ver todos nuestros trabajos ✨
        </p>
      </div>

      {lightbox !== null && filtered[lightbox] && (
        <Lightbox
          image={filtered[lightbox]!}
          hasNav={filtered.length > 1}
          onClose={close}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />
      )}
    </section>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
        active
          ? 'bg-gold text-ink border border-gold'
          : 'border border-beige-dark text-ink hover:border-gold/50'
      }`}
    >
      {children}
    </button>
  )
}

// Fullscreen lightbox rendered into <body> via a portal. Close on backdrop click,
// Escape (handled by the parent) or the ×; navigate with the arrows or a swipe.
function Lightbox({
  image, hasNav, onClose, onPrev, onNext,
}: {
  image: GalleryImage
  hasNav: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const [touchX, setTouchX] = useState<number | null>(null)

  function onTouchEnd(e: React.TouchEvent) {
    if (touchX === null) return
    const dx = e.changedTouches[0].clientX - touchX
    if (Math.abs(dx) > 50) (dx < 0 ? onNext : onPrev)()
    setTouchX(null)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95"
      onClick={onClose}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center text-white/70 hover:text-white text-3xl leading-none"
      >
        ×
      </button>

      {hasNav && (
        <>
          <button type="button" aria-label="Anterior"
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            className="absolute left-2 sm:left-6 w-11 h-11 flex items-center justify-center text-white/60 hover:text-white text-4xl">
            ‹
          </button>
          <button type="button" aria-label="Siguiente"
            onClick={(e) => { e.stopPropagation(); onNext() }}
            className="absolute right-2 sm:right-6 w-11 h-11 flex items-center justify-center text-white/60 hover:text-white text-4xl">
            ›
          </button>
        </>
      )}

      <figure className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-[92vw] h-[80vh]">
          <Image
            src={image.url}
            alt={image.title ?? 'Diseño'}
            fill
            sizes="92vw"
            className="object-contain"
            priority
          />
        </div>
        {(image.title || image.category) && (
          <figcaption className="text-center">
            {image.title && <p className="font-serif italic text-white text-lg leading-tight">{image.title}</p>}
            {image.category && <p className="text-gold-light text-xs mt-1 tracking-widest uppercase">{image.category.name}</p>}
          </figcaption>
        )}
      </figure>
    </div>,
    document.body,
  )
}
