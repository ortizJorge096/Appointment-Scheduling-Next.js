// src/components/public/Benefits.tsx
// "Why choose us" trust section with four value props (user-facing copy in Spanish).
const ITEMS = [
  { icon: '✦', title: 'Productos premium',    text: 'Marcas profesionales e insumos esterilizados en cada cita.' },
  { icon: '⏱', title: 'Puntualidad',          text: 'Agenda controlada para que nunca esperes más de la cuenta.' },
  { icon: '♥', title: 'Trato personalizado',  text: 'Consulta personalizada incluida para resaltar tus rasgos.' },
  { icon: '⟳', title: 'Garantía',             text: 'Retoques gratuitos dentro de las primeras 72 horas.' },
]

export default function Benefits() {
  return (
    <section id="beneficios" className="py-24 bg-beige">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-14">
          <span className="eyebrow-center">Por qué elegirnos</span>
          <h2 className="text-4xl lg:text-5xl font-serif font-light text-ink mt-5">
            Lujo accesible, <em className="text-gold italic">sin compromisos</em>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {ITEMS.map((it) => (
            <div key={it.title} className="text-center">
              <div className="flex justify-center mb-4">
                <span className="svc-icon-ring w-14 h-14 text-xl">{it.icon}</span>
              </div>
              <h3 className="font-serif text-xl text-ink mb-1.5">{it.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed max-w-[16rem] mx-auto">{it.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
