import Link from 'next/link'
import { STUDIO } from '@/lib/config'
import NextAvailability from './NextAvailability'
import HeroStats from './HeroStats'

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-ink flex items-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 120% at 80% 10%, #262017 0%, #1A1209 55%)' }}
      />
      <div className="absolute -top-32 -right-20 w-[520px] h-[520px] rounded-full pointer-events-none blur-sm"
        style={{ background: 'radial-gradient(circle, rgba(212,173,90,.32), transparent 65%)' }}
      />
      <div className="absolute -bottom-40 -left-32 w-[380px] h-[380px] rounded-full border border-gold/[0.22] pointer-events-none" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-16
                      grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="mb-6 animate-fade-up">
            <p className="logo-script text-gold text-4xl lg:text-5xl mb-1">
              {STUDIO.shortName}
            </p>
            <p className="logo-studio text-white/70 text-[0.6rem] lg:text-xs">
              {STUDIO.tagline} · {STUDIO.city}
            </p>
          </div>
          <h1 className="font-serif text-5xl lg:text-[64px] font-light text-white
                         leading-[1.08] mb-6 animate-fade-up animation-delay-100">
            Tu belleza,<br /><em className="text-gold italic">elevada al detalle</em>
          </h1>
          <p className="text-white/55 text-base leading-relaxed max-w-md mb-10
                        animate-fade-up animation-delay-200">
            {STUDIO.slogan} Reserva en línea en menos de 60 segundos, sin llamadas ni esperas.
          </p>
          <div className="flex flex-wrap gap-4 animate-fade-up animation-delay-300">
            <Link href="/agendar" className="btn-cta">Agendar cita</Link>
            <a href="#servicios" className="btn-outline-gold">Ver servicios</a>
          </div>
          <HeroStats />
        </div>

        <div className="hidden lg:flex flex-col gap-3">
          <NextAvailability />
          <div className="border-l-2 border-gold bg-white/[0.04] rounded-r-xl px-4 py-3">
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
