import type { Metadata } from 'next'
import Navbar from '@/components/public/Navbar'
import NosotrosImage from '@/components/public/NosotrosImage'
import NosotrosStats from '@/components/public/NosotrosStats'
import Hero from '@/components/public/Hero'
import AvailabilityBand from '@/components/public/AvailabilityBand'
import WhatsAppFab from '@/components/public/WhatsAppFab'
import ServicesGrid from '@/components/public/ServicesGrid'
import Galeria from '@/components/public/Galeria'
import Testimonios from '@/components/public/Testimonios'
import BookingSection from '@/components/public/BookingSection'
import FAQ from '@/components/public/FAQ'
import Footer from '@/components/public/Footer'
import { STUDIO, WHATSAPP_URL, MAILTO_URL } from '@/lib/config'
import { PinIcon, ClockIcon, PhoneIcon, MailIcon } from '@/components/public/ServiceIcons'

export const metadata: Metadata = { title: `Uñas, pestañas y cejas en ${STUDIO.city}` }

// Rendered per-request: BookingSection reads the booking settings from the DB
// (server-side, no flash). This opts the home out of build-time static
// prerender (where DATABASE_URL isn't available).
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <AvailabilityBand />
        <ServicesGrid />
        <BeneficiosSection />
        <Galeria />
        <Testimonios />
        <NosotrosSection />
        <BookingSection />
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
              {STUDIO.name} es un espacio pensado para ti, nació de un sueño sencillo pero
              poderoso: hacer que cada persona que entre por nuestra puerta salga sintiéndose
              mejor de lo que llegó.
            </p>
            <p className="text-ink-muted text-base leading-relaxed mb-4">
              Más de 3 años embelleciendo uñas, miradas y rostros en {STUDIO.city} nos han
              enseñado que la belleza va mucho más allá de la apariencia. Es el momento en que
              te permites descansar, cuidarte y recordar lo maravillosa que eres.
            </p>
            <p className="text-ink-muted text-base leading-relaxed mb-8">
              Aquí encontrarás técnicas actualizadas, productos de calidad y, sobre todo, manos
              que trabajan con amor y dedicación.
            </p>
            <NosotrosStats />
          </div>
          <NosotrosImage />
        </div>
      </div>
    </section>
  )
}

function ContactoSection() {
  const q       = encodeURIComponent(STUDIO.address)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${q}`
  const embedUrl = `https://www.google.com/maps?q=${q}&output=embed`
  return (
    <section id="contacto" className="py-24 bg-beige">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="section-tag justify-center mb-6">Contáctanos</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mb-4">
            ¿Tienes <em className="text-gold italic">preguntas</em>?
          </h2>
          <p className="text-ink-muted text-base leading-relaxed max-w-md mx-auto">
            Escríbenos por WhatsApp o al correo. Con gusto te asesoramos.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Contact info — unified clean list (same row style for every item) */}
          <div>
            <div className="flex gap-4 py-4 border-b border-beige-deeper items-start">
              <PinIcon className="text-gold w-5 h-5 shrink-0 mt-1" />
              <div className="min-w-0">
                <p className="text-xs text-gold tracking-widest uppercase mb-1">Dirección</p>
                <p className="text-[15px] text-ink">{STUDIO.address}</p>
              </div>
            </div>

            <div className="flex gap-4 py-4 border-b border-beige-deeper items-start">
              <ClockIcon className="text-gold w-5 h-5 shrink-0 mt-1" />
              <div className="min-w-0">
                <p className="text-xs text-gold tracking-widest uppercase mb-1">Horario</p>
                <p className="text-[15px] text-ink">{STUDIO.hours}</p>
              </div>
            </div>

            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"
              className="group flex gap-4 py-4 border-b border-beige-deeper items-start">
              <PhoneIcon className="text-gold w-5 h-5 shrink-0 mt-1" />
              <div className="min-w-0">
                <p className="text-xs text-gold tracking-widest uppercase mb-1">WhatsApp</p>
                <p className="text-[15px] text-ink group-hover:text-gold transition-colors">{STUDIO.phone}</p>
              </div>
            </a>

            <a href={MAILTO_URL} target="_blank" rel="noreferrer"
              className="group flex gap-4 py-4 border-b border-beige-deeper items-start">
              <MailIcon className="text-gold w-5 h-5 shrink-0 mt-1" />
              <div className="min-w-0">
                <p className="text-xs text-gold tracking-widest uppercase mb-1">Email</p>
                <p className="text-[15px] text-ink break-all group-hover:text-gold transition-colors">{STUDIO.email}</p>
              </div>
            </a>
          </div>

          {/* Map — rectangular, soft corners, controls fully accessible */}
          <div>
            <div className="rounded-xl overflow-hidden shadow-md border border-beige-dark/60 w-full h-[280px] lg:h-[380px]">
              <iframe
                src={embedUrl}
                title="Mapa — Valentina Jimenez Beauty Studio"
                width="100%" height="100%" loading="lazy"
                style={{ border: 0 }}
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="flex justify-center mt-4">
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-outline-gold">
                Cómo llegar
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
