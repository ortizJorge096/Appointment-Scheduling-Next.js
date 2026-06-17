import type { Metadata } from 'next'
import Navbar from '@/components/public/Navbar'
import NosotrosImage from '@/components/public/NosotrosImage'
import Hero from '@/components/public/Hero'
import WhatsAppFab from '@/components/public/WhatsAppFab'
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
        <BeneficiosSection />
        <Galeria />
        <NosotrosSection />
        <BookingSection />
        <UbicacionSection />
        <ContactoSection />
        <FAQ />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}

function BeneficiosSection() {
  const items = [
    { icon: '✦', title: 'Productos premium',       text: 'Marcas profesionales e insumos de primera en cada servicio.' },
    { icon: '✛', title: 'Bioseguridad',            text: 'Material esterilizado y protocolos de higiene estrictos.' },
    { icon: '♥', title: 'Atención personalizada',  text: 'Asesoría según tu estilo, tus rasgos y lo que buscas.' },
    { icon: '⏱', title: 'Puntualidad',             text: 'Agenda controlada para que nunca esperes de más.' },
  ]
  return (
    <section className="py-24 bg-beige/30">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="eyebrow-center">Por qué elegirnos</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mt-5">
            Lujo accesible, sin <em className="text-gold italic">compromisos</em>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((b) => (
            <div key={b.title} className="card-premium p-7 text-center">
              <div className="flex justify-center mb-4">
                <span className="svc-icon-ring w-14 h-14 text-2xl">{b.icon}</span>
              </div>
              <h3 className="font-serif text-xl text-ink mb-2">{b.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UbicacionSection() {
  const q        = encodeURIComponent(STUDIO.address)
  const mapsUrl  = `https://www.google.com/maps/search/?api=1&query=${q}`
  const embedUrl = `https://www.google.com/maps?q=${q}&output=embed`
  return (
    <section id="ubicacion" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="section-tag mb-6">Visítanos</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mb-6">
            Tu nuevo lugar <em className="text-gold italic">favorito</em>
          </h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="text-gold-dark">📍</span>
              <div>
                <p className="font-medium text-ink text-sm">Dirección</p>
                <p className="text-sm text-ink-muted">{STUDIO.address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-gold-dark">🕐</span>
              <div>
                <p className="font-medium text-ink text-sm">Horario</p>
                <p className="text-sm text-ink-muted">{STUDIO.hours}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-gold-dark">📱</span>
              <div>
                <p className="font-medium text-ink text-sm">Teléfono / WhatsApp</p>
                <p className="text-sm text-ink-muted">{STUDIO.phone}</p>
              </div>
            </div>
          </div>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-cta mt-8 inline-flex">
            Cómo llegar
          </a>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-md border border-beige-dark/60 h-[340px]">
          <iframe
            src={embedUrl}
            title="Mapa — Valentina Jimenez Beauty Studio"
            width="100%" height="100%" loading="lazy"
            style={{ border: 0 }}
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
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
          <NosotrosImage />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12 max-w-xl mx-auto">
          {[
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
