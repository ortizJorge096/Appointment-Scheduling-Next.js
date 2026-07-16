'use client'
// src/components/public/HeroCarousel.tsx
// Cinematic crossfade carousel — no external library. Stacked next/image slides
// with opacity transitions + a subtle Ken Burns zoom on the active one. Pauses
// on hover, hides nothing if an image fails (gradient fallback). Structure is
// video-ready: swap the slides for the commented <video> block below.

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { STUDIO } from '@/lib/config'

const SLIDE_MS = 5000

export default function HeroCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (paused || images.length <= 1) return
    timer.current = setInterval(() => setIndex((i) => (i + 1) % images.length), SLIDE_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [paused, images.length])

  const allFailed = images.length === 0 || images.every((_, i) => failed[i])

  return (
    <div
      className="relative w-full h-[280px] lg:h-[480px] rounded-[20px] overflow-hidden shadow-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fallback gradient — always behind the slides */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,var(--ink-soft) 0%,var(--ink) 60%,#0F0A05 100%)' }} />

      {images.map((src, i) => (
        failed[i] ? null : (
          <div key={src} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === index ? 'opacity-100' : 'opacity-0'}`}>
            <Image
              src={src}
              alt={`${STUDIO.shortName} — ${STUDIO.tagline} ${i + 1}`}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 45vw"
              className={`object-cover ${i === index ? 'hero-kenburns' : ''}`}
              onError={() => setFailed((f) => ({ ...f, [i]: true }))}
            />
          </div>
        )
      ))}

      {/* Edge-only overlay so the photo breathes in the center */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 100% at 50% 50%, transparent 55%, rgba(26,18,9,.45) 100%)' }} />

      {/* Placeholder mark if there are no usable images */}
      {allFailed && (
        <div className="absolute inset-0 flex items-center justify-center text-center px-6">
          <p className="logo-script text-gold/45 text-4xl">{STUDIO.shortName}</p>
        </div>
      )}

      {/* Dots — subtle, gold; 44px touch target on mobile */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex z-10">
          {images.map((_, i) => (
            <button key={i} type="button" aria-label={`Foto ${i + 1}`}
              onClick={() => setIndex(i)}
              className="grid place-items-center w-11 h-11 sm:w-6 sm:h-6">
              <span className={`block rounded-full transition-all duration-300 ${
                i === index ? 'bg-gold w-5 h-1.5' : 'bg-white/55 hover:bg-white/90 w-1.5 h-1.5'
              }`} />
            </button>
          ))}
        </div>
      )}

      {/* FUTURO: reemplazar el carrusel por video — el overlay y la estructura
          se mantienen igual, solo se cambian los slides por:
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/hero/hero-video.mp4" type="video/mp4" />
        </video>
      */}
    </div>
  )
}
