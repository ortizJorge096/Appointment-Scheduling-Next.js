// src/app/not-found.tsx
import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'

export const metadata = { title: 'Página no encontrada' }

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] flex items-center justify-center px-6 py-24">
        <div className="text-center max-w-md">
          {/* Número decorativo */}
          <p className="font-serif text-[9rem] leading-none text-gold/20 select-none">
            404
          </p>

          <h1 className="font-serif text-3xl text-ink -mt-4 mb-3">
            Página no encontrada
          </h1>

          <p className="text-ink-muted text-sm leading-relaxed mb-8">
            La dirección que buscas no existe o fue movida.
            <br />
            Vuelve al inicio o agenda tu cita desde aquí.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="btn-primary">
              Volver al inicio
            </Link>
            <Link href="/agendar" className="btn-outline">
              Agendar cita
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
