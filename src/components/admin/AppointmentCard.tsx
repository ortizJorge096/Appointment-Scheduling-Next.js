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
  return (
    <Link
      href={`/admin/citas/${appt.id}`}
      className="flex items-center justify-between px-6 py-4
                 hover:bg-beige transition-colors group border-b border-beige-dark last:border-0"
    >
      <div className="flex items-center gap-6">
        <div className="text-center w-14 shrink-0">
          <p className="font-serif text-lg text-ink">{appt.startTime}</p>
          <p className="text-[10px] text-ink-muted">{appt.endTime}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{appt.clientName}</p>
          <p className="text-xs text-ink-muted">{appt.service.name}</p>
          {showDate && (
            <p className="text-xs text-ink-muted/60 mt-0.5">
              {new Date(appt.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-sm text-gold hidden sm:block">{formatPrice(appt.service.price)}</p>
        <Badge variant={statusToBadge(appt.status)}>{STATUS_LABEL[appt.status]}</Badge>
        <span className="text-gold-light group-hover:text-gold transition-colors text-lg">›</span>
      </div>
    </Link>
  )
}
