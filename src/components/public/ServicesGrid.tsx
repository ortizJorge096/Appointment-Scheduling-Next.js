// src/components/public/ServicesGrid.tsx
import { prisma } from '@/lib/prisma'

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

export default async function ServicesGrid() {
  const services = await prisma.service.findMany({
    where: { isActive: true }, orderBy: { order: 'asc' },
  })

  return (
    <section id="servicios" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-16">
          <span className="section-tag justify-center mb-4">Especialidades</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            Nuestros <em className="text-gold italic">servicios</em>
          </h2>
        </div>

        <div className="grid border border-beige-dark"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {services.map((svc, i) => (
            <article key={svc.id}
              className="group p-10 border-r border-b border-beige-dark
                         hover:bg-ink transition-colors duration-300 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 h-0.5 bg-gold w-0
                              group-hover:w-full transition-all duration-300" />
              <p className="text-xs text-gold font-medium tracking-widest mb-5">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="font-serif text-2xl text-ink group-hover:text-white
                             transition-colors duration-300 mb-2">
                {svc.name}
              </h3>
              {svc.description && (
                <p className="text-sm text-ink-muted group-hover:text-white/50
                               transition-colors duration-300 leading-relaxed mb-6">
                  {svc.description}
                </p>
              )}
              <p className="text-gold text-lg font-medium">{formatPrice(svc.price)}</p>
              <p className="text-xs text-ink-muted group-hover:text-white/40
                             transition-colors duration-300 mt-0.5">
                {svc.durationMinutes} min
              </p>
            </article>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/agendar" className="btn-primary inline-block">Agendar mi cita</Link>
        </div>
      </div>
    </section>
  )
}

import Link from 'next/link'
