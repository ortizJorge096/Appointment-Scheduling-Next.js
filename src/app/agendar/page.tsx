import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/public/Navbar'
import BookingForm from '@/components/public/BookingForm'
import Footer from '@/components/public/Footer'
import WhatsAppFab from '@/components/public/WhatsAppFab'

export const metadata: Metadata = {
  title: 'Agendar cita',
}

export default function AgendarPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-beige pt-24 pb-16">
        <div className="text-center mb-12 px-6">
          <span className="section-tag justify-center mb-4">Flujo de reserva</span>
          <h1 className="font-serif text-4xl lg:text-5xl font-light text-ink">
            Agenda en menos de 60 segundos
          </h1>
        </div>
        <div className="max-w-3xl mx-auto px-6">
          <Suspense fallback={
            <div className="py-10 text-center text-ink-muted text-sm">
              Cargando...
            </div>
          }>
            <BookingForm />
          </Suspense>
        </div>
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
