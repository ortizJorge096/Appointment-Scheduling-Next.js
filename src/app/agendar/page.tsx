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
          <span className="section-tag justify-center mb-4">Reserva en línea</span>
          <h1 className="font-serif text-4xl lg:text-5xl font-light text-ink">
            Agenda tu <em className="text-gold italic">cita</em>
          </h1>
          <p className="text-ink-muted mt-3 text-sm">
            En menos de 60 segundos · Confirmación inmediata por email
          </p>
        </div>
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white border border-beige-dark/60 rounded-3xl p-8 lg:p-12 shadow-sm">
            <Suspense fallback={
              <div className="py-10 text-center text-ink-muted text-sm">
                Cargando...
              </div>
            }>
              <BookingForm />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
