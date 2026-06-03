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

export default function NextAvailability() {
  const [slot, setSlot] = useState<NextSlot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/availability/next')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setSlot(json.data)
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

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Lifting de pestañas', price: '$70.000', dur: '60 min' },
          { label: 'Cejas laminadas',     price: '$50.000', dur: '60 min' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.04] border border-white/10 p-4">
            <p className="text-white/70 text-sm font-medium mb-3">{s.label}</p>
            <p className="text-gold font-medium">{s.price}</p>
            <p className="text-xs text-white/30 mt-0.5">{s.dur}</p>
          </div>
        ))}
      </div>
    </>
  )
}
