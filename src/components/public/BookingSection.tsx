// src/components/public/BookingSection.tsx
import Link from 'next/link'

export default function BookingSection() {
  return (
    <section className="py-24 bg-ink">
      <div className="max-w-7xl mx-auto px-6 lg:px-10
                      grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-gold" />
            <span className="text-gold text-xs font-medium tracking-widest uppercase">
              Agendamiento en línea
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-white mb-6">
            Reserva en<br /><em className="text-gold italic">3 pasos</em>
          </h2>
          <p className="text-white/50 text-base leading-relaxed mb-10 max-w-md">
            Sin llamadas, sin esperas. Elige el servicio, la fecha y confirma.
            Recibirás confirmación por email de inmediato.
          </p>
          <div className="space-y-6 mb-10">
            {[
              { n: '1', title: 'Elige tu servicio',       desc: 'Gel, acrílico, nail art y más' },
              { n: '2', title: 'Selecciona fecha y hora', desc: 'Disponibilidad en tiempo real' },
              { n: '3', title: 'Confirma tus datos',      desc: 'Email inmediato de confirmación' },
            ].map((s) => (
              <div key={s.n} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full border border-gold text-gold
                                flex items-center justify-center text-xs shrink-0 mt-0.5">
                  {s.n}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{s.title}</p>
                  <p className="text-white/40 text-xs mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/agendar" className="btn-primary inline-block">Agendar ahora</Link>
        </div>

        <div className="bg-beige p-8 lg:p-10">
          <p className="font-serif text-xl text-ink font-light mb-6">¿Por qué elegirnos?</p>
          <div className="space-y-5">
            {[
              'Productos premium de larga duración',
              'Confirmación inmediata por email',
              'Sin pagos anticipados',
              'Recordatorio 24h antes de tu cita',
              'Atención personalizada y sin prisa',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3 text-sm text-ink-mid">
                <span className="text-gold text-xs">✦</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
