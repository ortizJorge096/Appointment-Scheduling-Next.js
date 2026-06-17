// src/components/public/ServicesGrid.tsx
// Renders one card per SPECIALTY (not the full service listing).
// Each card links to the booking flow pre-filtered by category.
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CATEGORY_ORDER, categoryLabel } from '@/lib/config'
import { CategoryIcon } from './ServiceIcons'

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

// Short intro line per category (user-facing copy stays in Spanish)
const CATEGORY_INTROS: Record<string, string> = {
  MANICURA:       'Manicura, gel, acrílico y nail art para manos impecables.',
  PEDICURA:       'Spa de pies, esmaltado y semipermanente.',
  CEJAS_PESTANAS: 'Diseño, laminado, lifting y volumen para tu mirada.',
  DEPILACION:     'Cera e hilo con técnicas suaves de precisión.',
  CORTE:          'Corte, peinado y tratamientos de cabello.',
  VIP:            'Combos y paquetes con precio especial.',
}

export default async function ServicesGrid() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  // Per-category summary: service count and minimum price ("desde").
  const categories = CATEGORY_ORDER
    .map((cat) => {
      const items = services.filter((s) => s.category === cat)
      const min = items.reduce((m, s) => Math.min(m, s.price), Infinity)
      return { cat, count: items.length, min }
    })
    .filter((c) => c.count > 0)

  return (
    <section id="servicios" className="py-24 bg-beige/20 relative overflow-hidden">
      <div
        className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #B8932A 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-16">
          <span className="eyebrow-center">Especialidades</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mt-5">
            Rituales de belleza a tu <em className="text-gold italic">medida</em>
          </h2>
          <p className="text-ink-muted text-sm mt-5 max-w-md mx-auto leading-relaxed">
            Elige una especialidad y reserva en línea con confirmación inmediata.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map(({ cat, count, min }) => (
            <Link
              key={cat}
              href={`/agendar?categoria=${cat}`}
              className="group card-premium-hover accent-top p-8 flex flex-col gap-4"
            >
              <span className="inline-flex items-center justify-center w-14 h-14
                               rounded-2xl bg-gold-pale text-gold-dark">
                <CategoryIcon category={cat} className="w-7 h-7" />
              </span>

              <div>
                <h3 className="font-serif text-2xl text-ink leading-tight">
                  {categoryLabel(cat)}
                </h3>
                <p className="text-sm text-ink-muted leading-relaxed mt-2">
                  {CATEGORY_INTROS[cat] ?? ''}
                </p>
              </div>

              <div className="flex items-end justify-between pt-4 mt-auto border-t border-beige-dark/60">
                <div>
                  {min !== Infinity && (
                    <p className="font-serif text-gold-dark text-xl leading-none">
                      desde {formatPrice(min)}
                    </p>
                  )}
                  <p className="text-[11px] text-ink-muted mt-1.5">
                    {count} servicio{count === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-xs tracking-widest uppercase font-semibold
                                 text-gold-dark group-hover:text-gold transition-colors">
                  Reservar →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link href="/agendar" className="btn-cta">Agendar cita ✦</Link>
        </div>
      </div>
    </section>
  )
}
