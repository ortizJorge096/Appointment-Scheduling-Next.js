import Link from 'next/link'
import { STUDIO } from '@/lib/config'
import { listHeroImages } from '@/lib/hero'
import HeroCarousel from './HeroCarousel'
import HeroSocialProof from './HeroSocialProof'

export default async function Hero() {
  // Auto-discovered from /public/hero/. Falls back to the single hero image.
  const found  = await listHeroImages()
  const images = found.length ? found : (STUDIO.heroImage ? [STUDIO.heroImage] : [])

  return (
    <section className="relative min-h-screen bg-ink flex items-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 120% at 80% 10%, #262017 0%, #1A1209 55%)' }}
      />
      <div className="absolute -top-32 -right-20 w-[520px] h-[520px] rounded-full pointer-events-none blur-sm"
        style={{ background: 'radial-gradient(circle, rgba(212,173,90,.32), transparent 65%)' }}
      />
      <div className="absolute -bottom-40 -left-32 w-[380px] h-[380px] rounded-full border border-gold/[0.22] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-16
                      grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 lg:gap-16 items-center">
        {/* Left — content (≈55%). On mobile it sits below the carousel. */}
        <div className="text-center lg:text-left max-lg:order-last">
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
            Realza tu<br /><em className="text-gold italic">mejor versión</em>
          </h1>

          <p className="text-white/55 text-base leading-relaxed max-w-md mx-auto lg:mx-0 mb-10
                        animate-fade-up animation-delay-200">
            Uñas, pestañas y cejas con acabado profesional. Agenda tu cita online en menos de un minuto.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center lg:justify-start animate-fade-up animation-delay-300">
            <Link href="/agendar" className="btn-cta w-full sm:w-auto text-center">Agendar cita</Link>
            <a href="#servicios" className="btn-outline-gold w-full sm:w-auto text-center">Ver servicios</a>
          </div>

          <HeroSocialProof />
        </div>

        {/* Right — cinematic carousel (≈45%). On mobile it sits on top, full width. */}
        <div className="animate-fade-up animation-delay-200 max-lg:order-first">
          <HeroCarousel images={images} />
        </div>
      </div>
    </section>
  )
}
