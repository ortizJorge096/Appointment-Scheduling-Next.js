// src/components/public/ServicesGrid.tsx
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CATEGORY_ORDER, categoryLabel } from '@/lib/config'

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

// Ornamento sutil distinto por categoría — añade carácter sin ruido visual
const CATEGORY_ORNAMENTS: Record<string, string> = {
  UNAS:     '✦',
  PESTANAS: '✧',
  CEJAS:    '✣',
  PROMOS:   '✺',
}

// Frase introductoria por categoría, mostrada bajo el título de la sección
const CATEGORY_INTROS: Record<string, string> = {
  UNAS:     'Manicura, pedicura, polygel y acrílico — para manos y pies impecables.',
  PESTANAS: 'Mirada definida con lifting, clásicas, volumen e híbridas.',
  CEJAS:    'Diseño, henna y laminado para enmarcar tu rostro.',
  PROMOS:   'Nuestros combos con precio especial.',
}

export default async function ServicesGrid() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: services.filter((s) => s.category === cat) }))
    .filter((g) => g.items.length > 0)

  return (
    <section id="servicios" className="py-24 bg-white relative overflow-hidden">
      {/* Decoración sutil de fondo */}
      <div
        className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #B8932A 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        {/* Header de sección */}
        <div className="text-center mb-16">
          <span className="section-tag justify-center mb-4">Especialidades</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            Nuestros <em className="text-gold italic">servicios</em>
          </h2>
          <p className="text-ink-muted text-sm mt-5 max-w-md mx-auto leading-relaxed">
            Cada servicio se reserva en línea con confirmación inmediata.
            Toca una tarjeta para agendar.
          </p>
        </div>

        <div className="space-y-20">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              {/* Encabezado de categoría */}
              <div className="mb-3 flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gold/40 text-sm">{CATEGORY_ORNAMENTS[cat] ?? '✦'}</span>
                    <p className="text-xs tracking-widest uppercase text-gold font-medium">
                      Categoría
                    </p>
                  </div>
                  <h3 className="font-serif text-3xl lg:text-4xl text-ink font-light leading-none">
                    {categoryLabel(cat)}
                  </h3>
                  {CATEGORY_INTROS[cat] && (
                    <p className="text-ink-muted text-sm mt-3 max-w-xl leading-relaxed">
                      {CATEGORY_INTROS[cat]}
                    </p>
                  )}
                </div>
                <span className="text-xs text-ink-muted tracking-widest uppercase whitespace-nowrap">
                  {items.length} {items.length === 1 ? 'servicio' : 'servicios'}
                </span>
              </div>

              <div className="h-px bg-beige-deeper mb-8" />

              {/* Tarjetas de servicios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((svc) => (
                  <Link
                    key={svc.id}
                    href={`/agendar?service=${svc.id}`}
                    className="group relative bg-white border border-beige-dark
                               hover:border-gold/60
                               transition-all duration-300
                               p-7 flex flex-col gap-3
                               hover:-translate-y-1
                               hover:shadow-[0_8px_30px_rgba(184,147,42,0.12)]"
                  >
                    {/* Acento gold lateral en hover */}
                    <span className="absolute left-0 top-6 bottom-6 w-[2px] bg-gold
                                     scale-y-0 group-hover:scale-y-100
                                     origin-center transition-transform duration-300" />

                    {/* Ornamento + categoría — diminuto, decorativo */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gold/40 text-xs">{CATEGORY_ORNAMENTS[cat] ?? '✦'}</span>
                      <span className="text-[10px] tracking-widest uppercase text-ink-muted/60">
                        {categoryLabel(cat)}
                      </span>
                    </div>

                    {/* Nombre */}
                    <h4 className="font-serif text-xl text-ink leading-tight
                                   group-hover:text-gold-dark transition-colors duration-300">
                      {svc.name}
                    </h4>

                    {/* Descripción */}
                    {svc.description && (
                      <p className="text-sm text-ink-muted leading-relaxed flex-1">
                        {svc.description}
                      </p>
                    )}

                    {/* Pie: precio (anclaje visual) + duración + CTA */}
                    <div className="flex items-end justify-between pt-4 mt-2
                                    border-t border-beige-dark/60">
                      <div>
                        <p className="text-gold font-medium text-base leading-none
                                      group-hover:text-gold-dark transition-colors">
                          {formatPrice(svc.price)}
                        </p>
                        <p className="flex items-center gap-1.5 text-[11px] text-ink-muted mt-1">
                          <span className="w-1 h-1 rounded-full bg-gold/40" />
                          {svc.durationMinutes} min
                        </p>
                      </div>
                      <span className="text-xs tracking-widest uppercase font-medium
                                       text-gold/70 group-hover:text-gold transition-colors">
                        Reservar
                        <span className="inline-block ml-1.5 transition-transform duration-300
                                         group-hover:translate-x-1">→</span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-20 pt-8 border-t border-beige-dark">
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-4">
            ¿No sabes qué elegir?
          </p>
          <Link href="/agendar" className="btn-primary inline-block">
            Ver todo el catálogo
          </Link>
        </div>
      </div>
    </section>
  )
}
