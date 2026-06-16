'use client'
// src/components/public/NosotrosImage.tsx
// Shows the illustration for the Nosotros section.
// If the file doesn't exist yet in public/, gracefully falls back to the gold gradient.

import { useState } from 'react'
import Image from 'next/image'

export default function NosotrosImage() {
  const [error, setError] = useState(false)

  return (
    <div className="relative">
      {/* Decorative background */}
      <div
        className="absolute inset-0 translate-x-4 translate-y-4 rounded-2xl"
        style={{ background: 'linear-gradient(160deg,#F2EBD9 0%,#D4AD5A 60%,#8A6E1E 100%)' }}
      />

      <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
        {error ? (
          /* Fallback: gradient when the image doesn't exist yet */
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(160deg,#F2EBD9 0%,#D4AD5A 60%,#8A6E1E 100%)' }}
          />
        ) : (
          <Image
            src="/muneca-nosotros.png"
            alt="Valentina Jimenez Beauty Studio"
            fill
            className="object-cover object-top"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            onError={() => setError(true)}
          />
        )}
      </div>

      <div className="absolute -bottom-6 -left-6 bg-ink border border-gold/30 p-5 shadow-lg rounded-xl">
        <p className="text-xs text-gold/60 tracking-widest uppercase mb-1">Especialistas en</p>
        <p className="font-serif text-lg text-white">Uñas · Pestañas · Cejas</p>
      </div>
    </div>
  )
}
