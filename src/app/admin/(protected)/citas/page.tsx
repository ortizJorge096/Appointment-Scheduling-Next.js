// src/app/admin/(protected)/citas/page.tsx
// Server Component: SSR the first page from the URL filters, then hand control
// to <CitasList> (client) which filters via /api/appointments without reloads.
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/authz'
import { formatInTimeZone } from 'date-fns-tz'
import ManualAppointmentModal from '@/components/admin/ManualAppointmentModal'
import { buildAppointmentListQuery } from '@/lib/appointmentList'
import { appointmentCharge, type AppointmentMoney } from '@/lib/accounting'
import CitasList, { type CitasFilters } from './CitasList'

export const metadata: Metadata = { title: 'Citas' }
export const dynamic = 'force-dynamic'

interface SearchParams {
  status?: string; scope?: string; origin?: string; payment?: string; paymentMethod?: string
  search?: string; serviceId?: string; categoryId?: string; amountMin?: string; amountMax?: string
  dateFrom?: string; dateTo?: string; page?: string; sort?: string
}

const LIMIT = 20
const num = (v?: string) => {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export default async function CitasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!(await requirePermission('citas:ver'))) redirect('/admin/no-autorizado')

  const sp   = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1'))
  const today = formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd')

  const { where, orderBy } = buildAppointmentListQuery({
    status: sp.status, scope: sp.scope, origin: sp.origin,
    payment: sp.payment, paymentMethod: sp.paymentMethod, search: sp.search,
    serviceId: sp.serviceId, categoryId: sp.categoryId,
    amountMin: num(sp.amountMin), amountMax: num(sp.amountMax),
    dateFrom: sp.dateFrom, dateTo: sp.dateTo,
    sort: sp.sort, sortExplicit: !!sp.sort, today,
  })

  const [appointments, total, services, categories] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        // Extras (appointment-level and per line) are part of the charge — `include`
        // gives the scalars (descuentoTipo/Valor) but not these relations.
        extras:  { select: { amount: true, appointmentServiceId: true } },
        service: { select: { name: true, price: true } },
        services: {
          include: {
            service: { select: { name: true, price: true } },
            extras:  { select: { amount: true } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * LIMIT, take: LIMIT,
    }),
    prisma.appointment.count({ where }),
    prisma.service.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { order: 'asc' } }),
  ])

  // Serialize to plain JSON (Date → ISO string) so the SSR initial data matches the
  // shape of subsequent /api/appointments responses — including the computed `total`
  // (charge after discounts, incl. extras), which the list renders and the raw DB
  // rows don't carry. Without it the first paint shows an empty price.
  const initialAppointments = JSON.parse(JSON.stringify(
    appointments.map((a) => ({
      ...a,
      total: a.precioFinal ?? appointmentCharge(a as unknown as AppointmentMoney),
    })),
  ))

  const initialFilters: CitasFilters = {
    search:     sp.search     ?? '',
    status:     sp.status     ?? '',
    scope:      sp.scope      ?? 'upcoming',
    origin:     sp.origin     ?? '',
    payment:       sp.payment       ?? '',
    paymentMethod: sp.paymentMethod ?? '',
    serviceId:  sp.serviceId  ?? '',
    categoryId: sp.categoryId ?? '',
    amountMin:  sp.amountMin  ?? '',
    amountMax:  sp.amountMax  ?? '',
    dateFrom:   sp.dateFrom   ?? '',
    dateTo:     sp.dateTo     ?? '',
    sort:       sp.sort       ?? 'upcoming',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Gestión</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Citas</h1>
        </div>
        <ManualAppointmentModal />
      </div>

      <CitasList
        initialAppointments={initialAppointments}
        initialPagination={{ total, page, limit: LIMIT, totalPages: Math.ceil(total / LIMIT) }}
        initialFilters={initialFilters}
        services={services}
        categories={categories}
      />
    </div>
  )
}
