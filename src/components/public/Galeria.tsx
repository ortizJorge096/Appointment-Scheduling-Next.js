// src/components/public/Galeria.tsx
// Server component. Reads active images from the DB and displays them with
// elegant fallback to gradients if nothing has been uploaded yet.

import { prisma } from '@/lib/prisma'
import { categoryLabel, INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'
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
  // Error-tolerant: if the bucket is not configured or the table is empty,
  // we show placeholder gradients without breaking the page.
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
          {showPlaceholders
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
            : realImages.map((img, i) => (
                <div key={i}
                  className={`relative overflow-hidden rounded-2xl shadow-sm group cursor-pointer bg-beige-dark ${spanFor(i)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url}
                    alt={img.title ?? 'Diseño'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent
                                  opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                    {img.title && <p className="font-serif italic text-white text-lg leading-tight">{img.title}</p>}
                    {img.description && <p className="text-white/80 text-xs mt-1 leading-snug">{img.description}</p>}
                    {img.category && <p className="text-gold-light text-xs mt-1.5 tracking-widest uppercase">{categoryLabel(img.category)}</p>}
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
