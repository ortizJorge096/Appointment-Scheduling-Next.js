'use client'
// src/app/cancelar/CancelarClient.tsx
// Cancelación pública de una cita mediante id + token del email.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AppointmentView {
  id: string
  service: { name: string }
  date: string
  startTime: string
  status: string
}

type Phase = 'loading' | 'ready' | 'cancelling' | 'cancelled' | 'notfound' | 'error'

export default function CancelarClient() {
  const params = useSearchParams()
  const id = params.get('id')
  const token = params.get('token')

  const [phase, setPhase] = useState<Phase>('loading')
  const [appt, setAppt] = useState<AppointmentView | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!id || !token) { setPhase('notfound'); return }
    fetch(`/api/appointments/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) { setPhase('notfound'); return }
        setAppt(json.data)
        setPhase(json.data.status === 'CANCELLED' ? 'cancelled' : 'ready')
      })
      .catch(() => setPhase('error'))
  }, [id, token])

  async function handleCancel() {
    setPhase('cancelling')
    setError(null)
    try {
      const res = await fetch(`/api/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (json.success) {
        setPhase('cancelled')
      } else {
        setError(json.error ?? 'No se pudo cancelar la cita.')
        setPhase('ready')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setPhase('ready')
    }
  }

  const dateLabel = appt
    ? format(new Date(appt.date), "EEEE d 'de' MMMM", { locale: es })
    : ''

  return (
    <main className="min-h-screen bg-beige flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">

        {phase === 'loading' && (
          <p className="text-ink-muted text-sm">Cargando tu cita...</p>
        )}

        {phase === 'notfound' && (
          <>
            <p className="font-serif text-3xl text-ink mb-3">Enlace no válido</p>
            <p className="text-ink-muted mb-6">No encontramos esta cita o el enlace está incompleto.</p>
            <Link href="/" className="btn-secondary inline-block">Volver al inicio</Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="font-serif text-3xl text-ink mb-3">Ups</p>
            <p className="text-ink-muted mb-6">Ocurrió un error. Intenta de nuevo más tarde.</p>
            <Link href="/" className="btn-secondary inline-block">Volver al inicio</Link>
          </>
        )}

        {phase === 'cancelled' && (
          <>
            <p className="font-serif text-4xl text-ink font-light mb-3">Cita cancelada</p>
            <p className="text-ink-muted mb-8">
              Tu cita fue cancelada. Cuando quieras, puedes agendar una nueva.
            </p>
            <Link href="/agendar" className="btn-primary inline-block">Agendar otra cita</Link>
          </>
        )}

        {(phase === 'ready' || phase === 'cancelling') && appt && (
          <>
            <h1 className="font-serif text-3xl text-ink font-light mb-2">¿Cancelar tu cita?</h1>
            <p className="text-ink-muted text-sm mb-8">Esta acción no se puede deshacer.</p>

            <div className="bg-white border border-beige-dark p-6 space-y-3 mb-6 text-left">
              {[
                { label: 'Servicio', value: appt.service.name },
                { label: 'Fecha',    value: dateLabel },
                { label: 'Hora',     value: appt.startTime },
              ].map(({ label, value }) => (
                <div key={label}
                  className="flex justify-between text-sm border-b border-beige-dark pb-3 last:border-0 last:pb-0">
                  <span className="text-ink-muted">{label}</span>
                  <span className="text-ink font-medium capitalize">{value}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6 text-left">
                <span className="mt-0.5">⚠</span> {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleCancel} disabled={phase === 'cancelling'}
                className="btn-primary disabled:opacity-70">
                {phase === 'cancelling' ? 'Cancelando...' : 'Sí, cancelar cita'}
              </button>
              <Link href="/" className="btn-secondary inline-block">Mantener cita</Link>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
