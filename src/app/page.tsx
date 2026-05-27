import type { Metadata } from 'next'
import Navbar from '@/components/public/Navbar'
import Hero from '@/components/public/Hero'
import ServicesGrid from '@/components/public/ServicesGrid'
import BookingSection from '@/components/public/BookingSection'
import Footer from '@/components/public/Footer'
import { STUDIO, WHATSAPP_URL, MAILTO_URL } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: `Manicure profesional en ${STUDIO.city}` }

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ServicesGrid />
        <GaleriaSection />
        <NosotrosSection />
        <BookingSection />
        <ContactoSection />
      </main>
      <Footer />
    </>
  )
}

function GaleriaSection() {
  const items = [
    { id: 1, label: 'Nail art floral',     sub: 'Gel · 60 min'      },
    { id: 2, label: 'Gel nude clásico',    sub: 'Gel · 60 min'      },
    { id: 3, label: 'Acrílico french',     sub: 'Acrílico · 90 min' },
    { id: 4, label: 'Nail art geométrico', sub: 'Nail art · 60 min' },
    { id: 5, label: 'Gel holográfico',     sub: 'Gel · 60 min'      },
    { id: 6, label: 'Manicure clásica',    sub: 'Clásica · 45 min'  },
  ]
  const grads = [
    'linear-gradient(145deg,#F2EBD9 0%,#B8932A 60%,#111111 100%)',
    'linear-gradient(145deg,#E8DCC4 0%,#D4AD5A 70%,#1E1E1E 100%)',
    'linear-gradient(145deg,#111111 0%,#B8932A 50%,#F2EBD9 100%)',
    'linear-gradient(145deg,#1E1E1E 0%,#D4AD5A 40%,#E8DCC4 100%)',
    'linear-gradient(145deg,#F5EDDA 0%,#8A6E1E 50%,#111111 100%)',
    'linear-gradient(145deg,#111111 30%,#B8932A 100%)',
  ]
  return (
    <section id="galeria" className="py-24 bg-beige">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="section-tag justify-center mb-4">Nuestro trabajo</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            Galería de <em className="text-gold italic">diseños</em>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <div key={item.id}
              className="aspect-square relative overflow-hidden group cursor-pointer">
              <div className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                style={{ background: grads[i] }} />
              <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100
                              transition-opacity duration-300 flex flex-col justify-end p-5">
                <p className="text-white text-sm font-medium">{item.label}</p>
                <p className="text-gold text-xs mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-ink-muted mt-8 italic">
          Síguenos en Instagram{' '}
          <a href={`https://instagram.com/${STUDIO.instagram}`}
            target="_blank" rel="noreferrer"
            className="text-gold hover:underline">
            @{STUDIO.instagram}
          </a>
          {' '}para ver todos nuestros trabajos
        </p>
      </div>
    </section>
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
              Pasión por el arte<br />en tus <em className="text-gold italic">manos</em>
            </h2>
            <p className="text-ink-muted text-base leading-relaxed mb-4">
              Somos un beauty studio especializado en manicure profesional en {STUDIO.city}.
              Más de 3 años dedicados al cuidado y embellecimiento de las manos con
              productos de alta calidad y técnicas actualizadas.
            </p>
            <p className="text-ink-muted text-base leading-relaxed mb-8">
              Nuestro compromiso es ofrecerte una experiencia premium, higiénica y con
              resultados duraderos. Cada clienta merece atención personalizada.
            </p>
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-beige-dark">
              {[
                { value: '+3',   label: 'Años de experiencia'  },
                { value: '+200', label: 'Clientas satisfechas'  },
                { value: '6',    label: 'Servicios disponibles' },
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
              <p className="text-xs text-gold/60 tracking-widest uppercase mb-1">Certificadas en</p>
              <p className="font-serif text-lg text-white">Nail art · Gel · Acrílico</p>
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
