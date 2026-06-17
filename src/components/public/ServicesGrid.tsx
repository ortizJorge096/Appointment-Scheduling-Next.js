// src/components/public/ServicesGrid.tsx
// Renders individual service cards matching the prototype design.
// Each card links to the booking flow pre-filtered by service ID.
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CategoryIcon } from './ServiceIcons'
import { formatPrice } from '@/lib/utils'

export default async function ServicesGrid() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  return (
    <section id="servicios" className="py-24 bg-beige/20 relative overflow-hidden">
      <div
        className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full pointer-events-none opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #B8932A 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-16">
          <span className="eyebrow-center">Servicios</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mt-5">
            Rituales de belleza a tu <em className="text-gold italic">medida</em>
          </h2>
          <p className="text-ink-muted text-sm mt-5 max-w-md mx-auto leading-relaxed">
            Cada servicio incluye consulta personalizada y productos premium.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((svc) => {
            const isVip = svc.category === 'VIP'
            return (
              <Link
                key={svc.id}
                href={`/agendar?service=${svc.id}`}
                className={`group card-premium-hover accent-top p-8 flex flex-col gap-4
                  ${isVip ? 'bg-ink text-white' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl
                  ${isVip ? 'bg-[rgba(212,173,90,.15)] text-[var(--gold-light)]' : 'bg-gold-pale text-gold-dark'}`}>
                  <CategoryIcon category={svc.category} className="w-7 h-7" />
                </span>

                <div>
                  <h3 className={`font-serif text-2xl leading-tight ${isVip ? 'text-white' : 'text-ink'}`}>
                    {svc.name}
                  </h3>
                  {svc.description && (
                    <p className={`text-sm leading-relaxed mt-2 ${isVip ? 'text-[#b7ae9c]' : 'text-ink-muted'}`}>
                      {svc.description}
                    </p>
                  )}
                </div>

                <div className={`flex items-end justify-between pt-4 mt-auto border-t
                  ${isVip ? 'border-[rgba(255,255,255,.08)]' : 'border-beige-dark/60'}`}>
                  <div>
                    <p className={`font-serif text-xl leading-none ${isVip ? 'text-[var(--gold-light)]' : 'text-gold-dark'}`}>
                      {formatPrice(svc.price)}
                    </p>
                    <p className={`text-[11px] mt-1.5 ${isVip ? 'text-[#b7ae9c]' : 'text-ink-muted'}`}>
                      {svc.durationMinutes} min
                    </p>
                  </div>
                  <span className={`text-xs tracking-widest uppercase font-semibold transition-colors
                    ${isVip ? 'text-[var(--gold-light)] group-hover:text-[var(--gold)]' : 'text-gold-dark group-hover:text-gold'}`}>
                    Reservar →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="text-center mt-16">
          <Link href="/agendar" className="btn-cta">Agendar cita ✦</Link>
        </div>
      </div>
    </section>
  )
}
