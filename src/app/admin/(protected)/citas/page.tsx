// src/app/admin/(protected)/citas/page.tsx
// Clean Server Component — no client event handlers
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import CitasFilters from './CitasFilters'
import ManualAppointmentModal from '@/components/admin/ManualAppointmentModal'
import { formatPrice, formatRequestedAt } from '@/lib/utils'
import { STATUS_LABEL, STATUS_CLASS } from '@/lib/appointmentStatus'
import { formatInTimeZone } from 'date-fns-tz'
import type { Prisma } from '@prisma/client'

export const metadata: Metadata = { title: 'Citas' }
export const dynamic = 'force-dynamic'

interface SearchParams { status?: string; dateFrom?: string; dateTo?: string; page?: string; sort?: string }

// Ordering options (kept in the URL so they persist + are shareable).
const SORT_OPTIONS = ['upcoming', 'recent', 'oldest', 'status'] as const
type Sort = (typeof SORT_OPTIONS)[number]
const ORDER_BY: Record<Sort, Prisma.AppointmentOrderByWithRelationInput[]> = {
  upcoming: [{ date: 'asc'  }, { startTime: 'asc' }],
  recent:   [{ createdAt: 'desc' }],
  oldest:   [{ createdAt: 'asc'  }],
  status:   [{ status: 'asc' }, { date: 'asc' }, { startTime: 'asc' }],
}

export default async function CitasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp       = await searchParams
  const page     = Math.max(1, parseInt(sp.page ?? '1'))
  const limit    = 20
  const status   = sp.status
  const dateFrom = sp.dateFrom
  const dateTo   = sp.dateTo
  const sort: Sort = SORT_OPTIONS.includes(sp.sort as Sort) ? (sp.sort as Sort) : 'upcoming'

  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') where.status = status
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
    }
  } else if (sort === 'upcoming') {
    // "Próximas primero" with no explicit date filter → show today onward only,
    // so the agenda isn't buried under months of past appointments.
    const todayStr = formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd')
    where.date = { gte: new Date(`${todayStr}T00:00:00`) }
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        service: { select: { name: true, price: true } },
        services: {
          include: { service: { select: { name: true, price: true } } },
        },
      },
      orderBy: ORDER_BY[sort],
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
      ...(sort !== 'upcoming' ? { sort } : {}),
      page: String(p),
    })
    return `/admin/citas?${params}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Gestión</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Citas</h1>
        </div>
        <ManualAppointmentModal />
      </div>

      <CitasFilters status={status} dateFrom={dateFrom} dateTo={dateTo} sort={sort} />

      {/* Table — desktop */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-x-auto">
        {appointments.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-sm">
            No hay citas con los filtros seleccionados.
          </div>
        ) : (
          <>
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-beige-dark bg-beige text-xs text-ink-muted uppercase tracking-widest">
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                  <th className="text-left px-5 py-3 font-medium">Hora</th>
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Servicio</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Valor</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Solicitada</th>
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
                      <p className="text-ink font-medium flex items-center gap-1.5">
                        {appt.clientName}
                        {!appt.clientEmail && (
                          <span title="Cliente sin email — no recibe notificaciones"
                            className="text-[10px] tracking-wide uppercase bg-beige text-ink-muted/70 border border-beige-dark px-1.5 py-0.5 rounded-full">
                            sin correo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-muted">{appt.clientPhone}</p>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
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
                    <td className="px-5 py-3.5 text-ink-muted text-xs whitespace-nowrap hidden lg:table-cell">
                      {formatRequestedAt(appt.createdAt)}
                    </td>
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

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-beige-dark">
              {appointments.map((appt) => (
                <Link key={appt.id} href={`/admin/citas/${appt.id}`}
                  className="block px-4 py-3 hover:bg-beige transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                      {appt.clientName}
                      {!appt.clientEmail && (
                        <span className="text-[9px] tracking-wide uppercase bg-beige text-ink-muted/70 border border-beige-dark px-1.5 py-0.5 rounded-full">
                          sin correo
                        </span>
                      )}
                    </p>
                    <span className={STATUS_CLASS[appt.status]}>{STATUS_LABEL[appt.status]}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{format(new Date(appt.date), 'd MMM', { locale: es })} · {appt.startTime}</span>
                    <span className="text-gold">
                      {formatPrice(
                        appt.services && appt.services.length > 1
                          ? appt.services.reduce((sum, s) => sum + s.price, 0)
                          : appt.service.price
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {appt.services && appt.services.length > 1
                      ? appt.services.map((s) => s.service.name).join(' + ')
                      : appt.service.name}
                  </p>
                  <p className="text-[11px] text-ink-muted/70 mt-0.5">Solicitada: {formatRequestedAt(appt.createdAt)}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-ink-muted">{total} citas · Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageUrl(page - 1)}
                className="px-3 py-2.5 sm:py-1.5 text-xs border border-beige-dark rounded-lg text-ink-muted hover:border-gold transition-colors">
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(page + 1)}
                className="px-3 py-2.5 sm:py-1.5 text-xs border border-beige-dark rounded-lg text-ink-muted hover:border-gold transition-colors">
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
