'use client'
// src/components/public/HeroImage.tsx
// Editorial hero photo panel (Variante B). Renders STUDIO.heroImage via
// next/image (optimized, priority). If no image is configured — or it fails to
// load — it gracefully falls back to an elegant brand gradient placeholder so
// the hero never shows a broken image. Swap the photo from STUDIO.heroImage.

import Image from 'next/image'
import { useState } from 'react'
import { STUDIO } from '@/lib/config'

export default function HeroImage() {
  const [failed, setFailed] = useState(false)
  const src = STUDIO.heroImage
  const showImage = !!src && !failed

  return (
    <div className="relative w-full h-[300px] lg:h-[420px] rounded-2xl overflow-hidden shadow-2xl">
      {/* Fallback gradient — always behind the image, visible if it's missing */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(160deg,#2A2014 0%,#1A1209 60%,#0F0A05 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{ background: 'radial-gradient(120% 80% at 70% 8%, rgba(212,173,90,.25), transparent 60%)' }}
      />

      {showImage && (
        <Image
          src={src}
          alt={`${STUDIO.shortName} — ${STUDIO.tagline}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}

      {/* Placeholder mark when there is no photo yet */}
      {!showImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <p className="logo-script text-gold/45 text-4xl leading-none">{STUDIO.shortName}</p>
          <p className="logo-studio text-white/25 text-[0.6rem] mt-2">{STUDIO.tagline}</p>
        </div>
      )}

      {/* Soft inner gold border for the editorial frame feel */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gold/15 pointer-events-none" />
    </div>
  )
}
