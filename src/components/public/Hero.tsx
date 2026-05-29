import Link from 'next/link'
import { STUDIO } from '@/lib/config'

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-ink flex items-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(184,147,42,0.12) 0%, transparent 70%)' }}
      />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-16
                      grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="flex items-center gap-3 mb-8 animate-fade-up">
            <div className="w-8 h-px bg-gold" />
            <span className="text-gold text-xs font-medium tracking-widest uppercase">
              {STUDIO.tagline} · {STUDIO.city}
            </span>
          </div>
          <h1 className="font-serif text-5xl lg:text-7xl font-light text-white
                         leading-[1.06] mb-6 animate-fade-up animation-delay-100">
            Realza tu<br /><em className="text-gold italic">belleza</em><br />natural
          </h1>
          <p className="text-white/55 text-base leading-relaxed max-w-md mb-10
                        animate-fade-up animation-delay-200">
            {STUDIO.slogan} Agenda tu cita en línea y disfruta de una experiencia a tu medida.
          </p>
          <div className="flex flex-wrap gap-4 animate-fade-up animation-delay-300">
            <Link href="/agendar" className="btn-primary">Reservar ahora</Link>
            <a href="#servicios" className="btn-outline-gold">Ver servicios</a>
          </div>
          <div className="flex gap-10 mt-14 pt-10 border-t border-white/10
                          animate-fade-up animation-delay-400">
            {[
              { value: '+2.400', label: 'Citas realizadas' },
              { value: '5★',     label: 'Calificación'     },
              { value: '+25',    label: 'Servicios'        },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-serif text-2xl text-gold font-light">{s.value}</p>
                <p className="text-xs text-white/40 mt-0.5 tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-3">
          <div className="bg-white/[0.06] border border-white/10 p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-2 h-2 rounded-full bg-gold" />
              <p className="text-xs text-white/40 tracking-widest uppercase">Próxima disponibilidad</p>
            </div>
            <p className="font-serif text-3xl text-white font-light mb-1">Hoy · 3:00 PM</p>
            <p className="text-white/50 text-sm">Manicura semipermanente</p>
            <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between">
              <span className="text-gold font-medium text-lg">$40.000</span>
              <span className="text-xs text-white/30">60 min · Confirmación inmediata</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Lifting de pestañas', price: '$70.000', dur: '60 min' },
              { label: 'Cejas laminadas',     price: '$50.000', dur: '60 min' },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.04] border border-white/10 p-4">
                <p className="text-white/70 text-sm font-medium mb-3">{s.label}</p>
                <p className="text-gold font-medium">{s.price}</p>
                <p className="text-xs text-white/30 mt-0.5">{s.dur}</p>
              </div>
            ))}
          </div>
          <div className="border-l-2 border-gold bg-white/[0.04] px-4 py-3">
            <p className="text-xs text-white/35">Incluye</p>
            <p className="text-white/70 text-sm mt-0.5">
              Recordatorio 24h antes · Sin pagos anticipados
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
