'use client'
// src/app/confirmacion/ConfirmacionClient.tsx
// Client component — uses useSearchParams to read the appointment ID

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { WHATSAPP_URL } from '@/lib/config'
import type { AppointmentWithService } from '@/types'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(price)
}

export default function ConfirmacionClient() {
  const params = useSearchParams()
  const id = params.get('id')

  const [appointment, setAppointment] = useState<AppointmentWithService | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)

  useEffect(() => {
    if (!id) { setError(true); setLoading(false); return }
    fetch(`/api/appointments/${id}`)
      .then((r) => r.json())
      .then((json) => { if (json.success) setAppointment(json.data); else setError(true) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return null // the Suspense fallback already shows the spinner

  if (error || !appointment) {
    return (
      <main className="min-h-screen bg-beige flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="font-serif text-3xl text-ink mb-3">Ups</p>
          <p className="text-ink-muted mb-6">No encontramos los detalles de tu cita.</p>
          <Link href="/agendar" className="btn-primary inline-block">Intentar de nuevo</Link>
        </div>
      </main>
    )
  }

  const dateFormatted = format(
    new Date(appointment.date),
    "EEEE d 'de' MMMM 'de' yyyy",
    { locale: es }
  )

  return (
    <main className="min-h-screen bg-beige flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full">

        {/* Check */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold-light to-gold flex items-center justify-center mx-auto mb-8 shadow-md">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-ink font-light mb-2">
            ¡Cita <em className="text-gold">confirmada</em>!
          </h1>
          <p className="text-ink-muted text-sm">
            Revisa tu email — te enviamos los detalles a{' '}
            <strong className="text-ink">{appointment.clientEmail}</strong>
          </p>
        </div>

        {/* Summary */}
        <div className="bg-white border border-beige-dark/60 rounded-2xl shadow-sm p-6 space-y-3 mb-6">
          {[
            { label: 'Código',   value: appointment.id.slice(0, 8).toUpperCase() },
            { label: 'Servicio', value: appointment.service.name },
            { label: 'Fecha',    value: dateFormatted },
            { label: 'Hora',     value: appointment.startTime },
            { label: 'Duración', value: `${appointment.service.durationMinutes} min` },
            { label: 'Valor',    value: formatPrice(appointment.service.price) },
          ].map(({ label, value }) => (
            <div key={label}
              className="flex justify-between text-sm border-b border-beige-dark pb-3 last:border-0 last:pb-0">
              <span className="text-ink-muted">{label}</span>
              <span className="text-ink font-medium capitalize">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-muted text-center leading-relaxed mb-8">
          Si necesitas cancelar, hazlo con al menos{' '}
          <strong className="text-ink">24 horas de anticipación</strong>.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-cta text-center">
            Escríbenos por WhatsApp
          </a>
          <Link href="/" className="btn-secondary text-center">Volver al inicio</Link>
        </div>

      </div>
    </main>
  )
}
