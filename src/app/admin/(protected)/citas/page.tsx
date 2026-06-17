// src/app/admin/(protected)/citas/page.tsx
// Clean Server Component — no client event handlers
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import CitasFilters from './CitasFilters'
import ManualAppointmentModal from '@/components/admin/ManualAppointmentModal'

export const metadata: Metadata = { title: 'Citas' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada', CANCELLED: 'Cancelada', NO_SHOW: 'No asistió',
}
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'badge-pending', CONFIRMED: 'badge-confirmed',
  COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled', NO_SHOW: 'badge-no_show',
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(p)
}

interface SearchParams { status?: string; dateFrom?: string; dateTo?: string; page?: string }

export default async function CitasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp       = await searchParams
  const page     = Math.max(1, parseInt(sp.page ?? '1'))
  const limit    = 20
  const status   = sp.status
  const dateFrom = sp.dateFrom
  const dateTo   = sp.dateTo

  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') where.status = status
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
    }
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: { service: { select: { name: true, price: true } } },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.appointment.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  function pageUrl(p: number) {
    const params = new URLSearchParams({
      ...(status   && status !== 'ALL' ? { status }   : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo   ? { dateTo }   : {}),
      page: String(p),
    })
    return `/admin/citas?${params}`
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Gestión</p>
          <h1 className="font-serif text-3xl text-ink font-light">Citas</h1>
        </div>
        <ManualAppointmentModal />
      </div>

      {/* Filters — Client Component */}
      <CitasFilters status={status} dateFrom={dateFrom} dateTo={dateTo} />

      {/* Table */}
      <div className="bg-white border border-beige-dark overflow-x-auto">
        {appointments.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">
            No hay citas con los filtros seleccionados.
          </div>
        ) : (
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
                  <td className="px-5 py-3.5 text-ink-muted hidden md:table-cell">{appt.service.name}</td>
                  <td className="px-5 py-3.5 text-gold hidden lg:table-cell">{formatPrice(appt.service.price)}</td>
                  <td className="px-5 py-3.5">
                    <span className={STATUS_CLASS[appt.status]}>{STATUS_LABEL[appt.status]}</span>
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
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-ink-muted">{total} citas · Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageUrl(page - 1)}
                className="px-3 py-1.5 text-xs border border-beige-dark text-ink-muted hover:border-gold">
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(page + 1)}
                className="px-3 py-1.5 text-xs border border-beige-dark text-ink-muted hover:border-gold">
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
