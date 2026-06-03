// src/components/public/Galeria.tsx
// Server component. Lee las imágenes activas de la BD y las muestra con
// fallback elegante a gradientes si aún no hay nada subido.

import { prisma } from '@/lib/prisma'
import { STUDIO, categoryLabel, INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'
import { getPublicUrl } from '@/lib/s3'

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(145deg,#F2EBD9 0%,#B8932A 60%,#111111 100%)',
  'linear-gradient(145deg,#E8DCC4 0%,#D4AD5A 70%,#1E1E1E 100%)',
  'linear-gradient(145deg,#111111 0%,#B8932A 50%,#F2EBD9 100%)',
  'linear-gradient(145deg,#1E1E1E 0%,#D4AD5A 40%,#E8DCC4 100%)',
  'linear-gradient(145deg,#F5EDDA 0%,#8A6E1E 50%,#111111 100%)',
  'linear-gradient(145deg,#111111 30%,#B8932A 100%)',
]

const PLACEHOLDER_ITEMS = [
  { label: 'Volumen brasilero',       sub: 'Pestañas · 120 min' },
  { label: 'Acrílico esculpido',      sub: 'Uñas · 120 min'     },
  { label: 'Cejas laminadas',         sub: 'Cejas · 60 min'     },
  { label: 'Lifting de pestañas',     sub: 'Pestañas · 60 min'  },
  { label: 'Manicura semipermanente', sub: 'Uñas · 60 min'      },
  { label: 'Cejas con henna',         sub: 'Cejas · 45 min'     },
]

export default async function Galeria() {
  // Tolerante a errores: si el bucket no está configurado o la tabla está vacía,
  // mostramos los gradientes placeholder sin romper la página.
  let realImages: Array<{ url: string; title: string | null; description: string | null; category: string | null }> = []
  try {
    const rows = await prisma.galleryImage.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: 12,
    })
    realImages = rows.map((r) => ({
      url: getPublicUrl(r.s3Key),
      title: r.title,
      description: r.description,
      category: r.category,
    }))
  } catch {
    realImages = []
  }

  const showPlaceholders = realImages.length === 0

  return (
    <section id="galeria" className="py-24 bg-beige">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="section-tag justify-center mb-4">Nuestro trabajo</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            Galería de <em className="text-gold italic">diseños</em>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {showPlaceholders
            ? PLACEHOLDER_ITEMS.map((item, i) => (
                <div key={item.label}
                  className="aspect-square relative overflow-hidden group cursor-pointer">
                  <div className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                    style={{ background: PLACEHOLDER_GRADIENTS[i % PLACEHOLDER_GRADIENTS.length] }} />
                  <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100
                                  transition-opacity duration-300 flex flex-col justify-end p-5">
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-gold text-xs mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))
            : realImages.map((img, i) => (
                <div key={i}
                  className="aspect-square relative overflow-hidden group cursor-pointer bg-beige-dark">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url}
                    alt={img.title ?? 'Diseño'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  {(img.title || img.description || img.category) && (
                    <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100
                                    transition-opacity duration-300 flex flex-col justify-end p-5">
                      {img.title && <p className="text-white text-sm font-medium leading-snug">{img.title}</p>}
                      {img.description && <p className="text-white/80 text-xs mt-1 leading-snug">{img.description}</p>}
                      {img.category && <p className="text-gold text-xs mt-1.5 tracking-wide uppercase">{categoryLabel(img.category)}</p>}
                    </div>
                  )}
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
