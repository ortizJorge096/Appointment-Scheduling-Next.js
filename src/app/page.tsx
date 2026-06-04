import type { Metadata } from 'next'
import Navbar from '@/components/public/Navbar'
import Hero from '@/components/public/Hero'
import ServicesGrid from '@/components/public/ServicesGrid'
import Galeria from '@/components/public/Galeria'
import BookingSection from '@/components/public/BookingSection'
import FAQ from '@/components/public/FAQ'
import Footer from '@/components/public/Footer'
import { STUDIO, WHATSAPP_URL, MAILTO_URL } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: `Uñas, pestañas y cejas en ${STUDIO.city}` }

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ServicesGrid />
        <Galeria />
        <NosotrosSection />
        <BookingSection />
        <ContactoSection />
        <FAQ />
      </main>
      <Footer />
    </>
  )
}

function NosotrosSection() {
  return (
    <section id="nosotros" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="section-tag mb-6">Quiénes somos</span>
            <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mb-6">
              Pasión por<br />realzar tu <em className="text-gold italic">belleza</em>
            </h2>
            <p className="text-ink-muted text-base leading-relaxed mb-4">
              Somos un beauty studio especializado en uñas, pestañas y cejas en {STUDIO.city}.
              Más de 3 años dedicados al cuidado y embellecimiento de manos, mirada y rostro
              con productos de alta calidad y técnicas actualizadas.
            </p>
            <p className="text-ink-muted text-base leading-relaxed mb-8">
              Nuestro compromiso es ofrecerte una experiencia premium, higiénica y con
              resultados duraderos. Cada clienta merece atención personalizada.
            </p>
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-beige-dark">
              {[
                { value: '+3',   label: 'Años de experiencia'  },
                { value: '+200', label: 'Clientas satisfechas'  },
                { value: '+25',  label: 'Servicios disponibles' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-serif text-3xl text-gold font-light">{s.value}</p>
                  <p className="text-xs text-ink-muted mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="w-full aspect-[4/5]"
              style={{ background: 'linear-gradient(160deg,#F2EBD9 0%,#B8932A 50%,#111111 100%)' }} />
            <div className="absolute -bottom-6 -left-6 bg-ink border border-gold/30 p-5 shadow-lg">
              <p className="text-xs text-gold/60 tracking-widest uppercase mb-1">Especialistas en</p>
              <p className="font-serif text-lg text-white">Uñas · Pestañas · Cejas</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactoSection() {
  return (
    <section id="contacto" className="py-24 bg-beige">
      <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center">
        <span className="section-tag justify-center mb-6">Contáctanos</span>
        <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mb-4">
          ¿Tienes <em className="text-gold italic">preguntas</em>?
        </h2>
        <p className="text-ink-muted text-base leading-relaxed mb-12 max-w-md mx-auto">
          Escríbenos por WhatsApp o al correo. Con gusto te asesoramos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            {
              icon: '📍',
              label: 'Ubicación',
              value: STUDIO.city,
              sub: `${STUDIO.state}, ${STUDIO.country}`,
              href: undefined,
            },
            {
              icon: '📱',
              label: 'WhatsApp',
              value: STUDIO.phone,
              sub: STUDIO.hours,
              href: WHATSAPP_URL,
            },
            {
              icon: '✉️',
              label: 'Email',
              value: STUDIO.email,
              sub: 'Respondemos en 24h',
              href: MAILTO_URL,
            },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-beige-dark p-6 text-left">
              <p className="text-2xl mb-3">{item.icon}</p>
              <p className="text-xs text-gold tracking-widest uppercase mb-2">{item.label}</p>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer"
                  className="text-sm text-ink font-medium hover:text-gold transition-colors block">
                  {item.value}
                </a>
              ) : (
                <p className="text-sm text-ink font-medium">{item.value}</p>
              )}
              <p className="text-xs text-ink-muted mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-primary inline-block">
          Escribir por WhatsApp
        </a>
      </div>
    </section>
  )
}
