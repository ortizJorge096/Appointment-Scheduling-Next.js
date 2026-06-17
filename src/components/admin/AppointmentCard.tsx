// src/components/admin/AppointmentCard.tsx
import Link from 'next/link'
import { Badge, statusToBadge, STATUS_LABEL } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'
import type { AppointmentWithService } from '@/types'

interface Props {
  appointment: AppointmentWithService
  showDate?:   boolean
}

export function AppointmentCard({ appointment: appt, showDate = false }: Props) {
  // Multi-service support
  const isMultiService = appt.services && appt.services.length > 1
  const serviceName = isMultiService
    ? appt.services!.map((s) => s.service.name).join(' + ')
    : appt.service.name
  const totalPrice = isMultiService
    ? appt.services!.reduce((sum, s) => sum + s.price, 0)
    : appt.service.price

  return (
    <Link
      href={`/admin/citas/${appt.id}`}
      className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4
                 hover:bg-beige transition-colors group border-b border-beige-dark last:border-0"
    >
      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
        <div className="text-center w-12 sm:w-14 shrink-0">
          <p className="font-serif text-lg text-ink">{appt.startTime}</p>
          <p className="text-[10px] text-ink-muted">{appt.endTime}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{appt.clientName}</p>
          <p className="text-xs text-ink-muted truncate">{serviceName}</p>
          {showDate && (
            <p className="text-xs text-ink-muted/60 mt-0.5">
              {new Date(appt.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <p className="text-sm text-gold hidden sm:block">{formatPrice(totalPrice)}</p>
        <Badge variant={statusToBadge(appt.status)}>{STATUS_LABEL[appt.status]}</Badge>
        <span className="text-gold-light group-hover:text-gold transition-colors text-lg">›</span>
      </div>
    </Link>
  )
}
