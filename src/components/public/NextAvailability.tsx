'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface NextSlot {
  date: string
  startTime: string
  endTime: string
  service: {
    id: string
    name: string
    price: number
    durationMinutes: number
  }
}

interface ServicePreview {
  id: string
  name: string
  price: number
  durationMinutes: number
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(price)
}

export default function NextAvailability() {
  const [slot, setSlot]         = useState<NextSlot | null>(null)
  const [preview, setPreview]   = useState<ServicePreview[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Cargar siguiente slot disponible y primeros 2 servicios activos en paralelo
    Promise.all([
      fetch('/api/availability/next').then((r) => r.json()),
      fetch('/api/services').then((r) => r.json()),
    ])
      .then(([nextJson, svcJson]) => {
        if (nextJson.success && nextJson.data) setSlot(nextJson.data)
        if (svcJson.success && Array.isArray(svcJson.data)) {
          setPreview(svcJson.data.slice(0, 2))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dateLabel = slot
    ? (() => {
        const today = new Date().toISOString().slice(0, 10)
        if (slot.date === today) return 'Hoy'
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        if (slot.date === tomorrow) return 'Mañana'
        return format(new Date(slot.date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
      })()
    : null

  return (
    <>
      {loading ? (
        <div className="bg-white/[0.06] border border-white/10 p-7">
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="h-7 w-40 bg-white/10 rounded" />
            <div className="h-3 w-36 bg-white/10 rounded" />
            <div className="h-px bg-white/10 my-4" />
            <div className="h-5 w-20 bg-white/10 rounded" />
          </div>
        </div>
      ) : slot ? (
        <div className="bg-white/[0.06] border border-white/10 p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <p className="text-xs text-white/40 tracking-widest uppercase">Próxima disponibilidad</p>
          </div>
          <p className="font-serif text-3xl text-white font-light mb-1">
            {dateLabel} &middot; {slot.startTime}
          </p>
          <p className="text-white/50 text-sm">{slot.service.name}</p>
          <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between">
            <span className="text-gold font-medium text-lg">
              ${slot.service.price.toLocaleString('es-CO')}
            </span>
            <span className="text-xs text-white/30">{slot.service.durationMinutes} min &middot; Confirmación inmediata</span>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.06] border border-white/10 p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <p className="text-xs text-white/40 tracking-widest uppercase">Próxima disponibilidad</p>
          </div>
          <p className="font-serif text-2xl text-white/40 font-light">
            No hay disponibilidad próxima
          </p>
          <p className="text-white/30 text-sm mt-1">Intenta con otra fecha</p>
        </div>
      )}

      {preview.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {preview.map((s) => (
            <div key={s.id} className="bg-white/[0.04] border border-white/10 p-4">
              <p className="text-white/70 text-sm font-medium mb-3 leading-snug">{s.name}</p>
              <p className="text-gold font-medium">{formatPrice(s.price)}</p>
              <p className="text-xs text-white/30 mt-0.5">{s.durationMinutes} min</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
