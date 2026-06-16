'use client'
// src/components/public/FAQ.tsx
// Sección de preguntas frecuentes — acordeón interactivo

import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: '¿Con cuánto tiempo de anticipación debo agendar mi cita?',
    answer:
      'Puedes agendar con el tiempo que necesites, siempre que haya disponibilidad. Para asegurar tu horario preferido, te recomendamos hacerlo con al menos 2–3 días de anticipación, especialmente los fines de semana.',
  },
  {
    question: '¿Puedo cancelar o reprogramar mi cita?',
    answer:
      'Sí. Puedes cancelar desde el link que llega en tu email de confirmación, con al menos 24 horas de anticipación. Para reprogramar, escríbenos por WhatsApp y te buscamos un nuevo horario.',
  },
  {
    question: '¿Qué debo llevar o hacer antes de mi cita?',
    answer:
      'Para uñas: llega sin esmalte si es posible. Para pestañas: sin máscara de pestañas ni base. Para cejas: sin depilar al menos 2 semanas antes para que podamos diseñar mejor la forma. En todos los casos, llega puntual — el tiempo de tu turno incluye el proceso completo.',
  },
  {
    question: '¿Los materiales y productos son de calidad?',
    answer:
      'Sí. Trabajamos exclusivamente con marcas reconocidas en el mercado, aptas para piel sensible. Todos nuestros implementos son desechables o esterilizados entre clientas. Tu seguridad e higiene son nuestra prioridad.',
  },
  {
    question: '¿Cuánto duran los servicios?',
    answer:
      'Depende del servicio. Una manicura tradicional toma ~45 min; semipermanente o acrílico entre 60–90 min; lifting de pestañas 60–75 min; cejas 45–60 min. Al agendar verás la duración exacta de cada servicio.',
  },
  {
    question: '¿Aceptan walk-ins (sin cita previa)?',
    answer:
      'Trabajamos principalmente con cita previa para garantizarte atención sin esperas. Si hay disponibilidad en el momento, con gusto te atendemos — pero no lo podemos asegurar. Agendar en línea es la mejor opción.',
  },
  {
    question: '¿Cómo puedo pagar?',
    answer:
      'Aceptamos efectivo, transferencias y Nequi/Daviplata. El pago se realiza al finalizar el servicio, directamente en el estudio.',
  },
  {
    question: '¿Hay algún cuidado especial después del servicio?',
    answer:
      'Te damos las indicaciones según el servicio al terminar tu cita. En general: evita mojar las uñas las primeras horas, no te frotes los ojos tras el lifting, y protege las cejas del sol las primeras 24h.',
  },
]

function FAQAccordionItem({ item, isOpen, onToggle }: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-beige-dark last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-ink group-hover:text-gold transition-colors leading-snug">
          {item.question}
        </span>
        <span className={`shrink-0 w-5 h-5 flex items-center justify-center text-gold transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      {isOpen && (
        <p className="text-sm text-ink-muted leading-relaxed pb-5 pr-8">
          {item.answer}
        </p>
      )}
    </div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function toggle(i: number) {
    setOpenIndex(openIndex === i ? null : i)
  }

  const half = Math.ceil(FAQS.length / 2)
  const left  = FAQS.slice(0, half)
  const right = FAQS.slice(half)

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="section-tag justify-center mb-4">FAQ</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink">
            Preguntas <em className="text-gold italic">frecuentes</em>
          </h2>
          <p className="text-ink-muted text-base mt-4 max-w-md mx-auto">
            ¿Tienes dudas? Aquí resolvemos las más comunes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16">
          <div className="border-t border-beige-dark">
            {left.map((item, i) => (
              <FAQAccordionItem
                key={i}
                item={item}
                isOpen={openIndex === i}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>
          <div className="border-t border-beige-dark mt-0 lg:mt-0">
            {right.map((item, i) => (
              <FAQAccordionItem
                key={i + half}
                item={item}
                isOpen={openIndex === i + half}
                onToggle={() => toggle(i + half)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
