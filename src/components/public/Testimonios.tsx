// src/components/public/Testimonios.tsx
//
// ⚠️ PLACEHOLDER CONTENT — TESTIMONIALS below are example copy for layout
// purposes only (no fabricated full names, only initials + a generic role,
// to avoid implying real client identities). Replace with real reviews
// (Google, Instagram, WhatsApp) before this section goes live in production.

const TESTIMONIALS = [
  {
    initials: 'C.M.',
    quote: 'El mejor lifting de pestañas que me he hecho. El espacio es precioso y la atención impecable.',
    label: 'Clienta frecuente',
  },
  {
    initials: 'D.R.',
    quote: 'Mis uñas duraron impecables casi un mes. Reservar por internet fue facilísimo.',
    label: 'Clienta VIP',
  },
  {
    initials: 'V.P.',
    quote: 'Profesionalismo de principio a fin. Me encanta el recordatorio antes de mi cita.',
    label: 'Clienta habitual',
  },
]

export default function Testimonios() {
  return (
    <section id="testimonios" className="py-24 bg-ink">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="eyebrow-center text-gold-light">Testimonios</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-white mt-5">
            Lo que dicen <em className="text-gold italic">nuestras clientas</em>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.initials}
              className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-gold/[0.18] rounded-2xl p-7">
              <div className="text-gold-light tracking-[3px] mb-4" aria-hidden>★★★★★</div>
              <p className="text-white/80 text-[15px] leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full
                                 bg-gradient-to-br from-gold-light to-gold text-ink font-serif font-semibold shrink-0">
                  {t.initials}
                </span>
                <p className="text-white text-sm font-medium">{t.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
