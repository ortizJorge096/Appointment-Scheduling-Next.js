// src/components/admin/AppointmentsTable.tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge, statusToBadge, STATUS_LABEL } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'
import type { AppointmentWithService } from '@/types'

interface Props {
  appointments: AppointmentWithService[]
  emptyMessage?: string
}

export function AppointmentsTable({ appointments, emptyMessage = 'No hay citas.' }: Props) {
  if (appointments.length === 0) {
    return (
      <div className="py-16 text-center text-ink-muted text-sm bg-white border border-beige-dark">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-beige-dark overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige-dark bg-beige text-xs text-ink-muted uppercase tracking-widest">
              <th className="text-left px-5 py-3 font-medium">Fecha</th>
              <th className="text-left px-5 py-3 font-medium">Hora</th>
              <th className="text-left px-5 py-3 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Servicio</th>
              <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Valor</th>
              <th className="text-left px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-beige-dark">
            {appointments.map((appt) => (
              <tr key={appt.id} className="hover:bg-beige transition-colors group">
                <td className="px-5 py-3.5 text-ink whitespace-nowrap">
                  {format(new Date(appt.date), 'd MMM yyyy', { locale: es })}
                </td>
                <td className="px-5 py-3.5 text-ink-muted font-mono text-xs">{appt.startTime}</td>
                <td className="px-5 py-3.5">
                  <p className="text-ink font-medium">{appt.clientName}</p>
                  <p className="text-xs text-ink-muted">{appt.clientPhone}</p>
                </td>
                <td className="px-5 py-3.5 text-ink-muted hidden md:table-cell">
                  {appt.services && appt.services.length > 1
                    ? appt.services.map((s) => s.service.name).join(' + ')
                    : appt.service.name}
                </td>
                <td className="px-5 py-3.5 text-gold hidden lg:table-cell">
                  {formatPrice(
                    appt.services && appt.services.length > 1
                      ? appt.services.reduce((sum, s) => sum + s.price, 0)
                      : appt.service.price
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <Badge variant={statusToBadge(appt.status)}>{STATUS_LABEL[appt.status]}</Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link href={`/admin/citas/${appt.id}`}
                    className="text-xs text-gold-light group-hover:text-gold transition-colors">
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
