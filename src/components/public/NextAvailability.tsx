'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'

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


export default function NextAvailability() {
  const [slot, setSlot]         = useState<NextSlot | null>(null)
  const [preview, setPreview]   = useState<ServicePreview[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Load next available slot and first 2 active services in parallel
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
        <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-gold/25 backdrop-blur-md rounded-2xl p-[22px]">
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="h-7 w-40 bg-white/10 rounded" />
            <div className="h-3 w-36 bg-white/10 rounded" />
            <div className="h-px bg-white/10 my-4" />
            <div className="h-5 w-20 bg-white/10 rounded" />
          </div>
        </div>
      ) : slot ? (
        <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-gold/25 backdrop-blur-md rounded-2xl p-[22px]">
          <p className="font-serif text-xl text-gold-light mb-1">Próxima disponibilidad</p>
          <p className="text-white/45 text-[13px] mb-1">{dateLabel}, elige tu hora</p>
          <div className="flex justify-between items-center gap-3 px-3.5 py-[11px] rounded-xl bg-white/5 mt-2.5 text-sm text-white/85">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold-light shadow-[0_0_0_4px_rgba(212,173,90,0.18)]" />
              {slot.service.name}
            </span>
            <b className="text-white font-medium">{slot.startTime}</b>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-gold/25 backdrop-blur-md rounded-2xl p-[22px]">
          <p className="font-serif text-xl text-gold-light mb-1">Próxima disponibilidad</p>
          <p className="text-white/45 text-sm mt-1">No hay disponibilidad próxima</p>
          <Link href="/agendar"
            className="inline-block text-sm text-gold hover:text-gold-light transition-colors mt-3">
            Ver disponibilidad completa →
          </Link>
        </div>
      )}

      {preview.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {preview.map((s) => (
            <div key={s.id} className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
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
