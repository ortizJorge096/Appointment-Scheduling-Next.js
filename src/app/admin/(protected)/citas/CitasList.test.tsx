import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CitasList, { type CitasFilters } from './CitasList'

// next/link → plain anchor so the list renders in jsdom.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

const APPT = {
  id: 'apt-1', clientName: 'Ana', clientEmail: 'a@t.com', clientPhone: '3001112233',
  date: '2026-07-10', startTime: '10:00', status: 'CONFIRMED', origin: 'MANUAL',
  createdAt: new Date().toISOString(),
  service: { name: 'Manicura', price: 35000 }, services: [] as { price: number; service: { name: string } }[],
}
const BASE_FILTERS: CitasFilters = {
  search: '', status: '', scope: 'upcoming', origin: '', payment: '', serviceId: '', categoryId: '',
  amountMin: '', amountMax: '', dateFrom: '', dateTo: '', sort: 'upcoming',
}
const PAGINATION = { total: 1, page: 1, limit: 20, totalPages: 1 }

function setup(filters: Partial<CitasFilters> = {}) {
  return render(
    <CitasList
      initialAppointments={[APPT] as never}
      initialPagination={PAGINATION}
      initialFilters={{ ...BASE_FILTERS, ...filters }}
      services={[]}
      categories={[]}
    />,
  )
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, data: { appointments: [], pagination: PAGINATION } }),
  } as Response)
})

describe('CitasList', () => {
  it('no refetchea en el render inicial (SSR ya trajo la primera página)', () => {
    setup()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('al elegir "Completada" desde "Próximas" cambia el scope a "Todas" y refetchea', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /completada/i }))

    await waitFor(() => {
      const url = String(vi.mocked(global.fetch).mock.calls.at(-1)?.[0] ?? '')
      expect(url).toContain('status=COMPLETED')
      expect(url).toContain('scope=all')
    })
  })

  it('refetichea con los filtros actuales cuando llega el evento "cita-creada"', async () => {
    setup()
    window.dispatchEvent(new CustomEvent('cita-creada', { detail: { scope: null } }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })

  it('el evento "cita-creada" con scope "past" salta a "Pasadas"', async () => {
    setup()
    window.dispatchEvent(new CustomEvent('cita-creada', { detail: { scope: 'past' } }))
    await waitFor(() => {
      const url = String(vi.mocked(global.fetch).mock.calls.at(-1)?.[0] ?? '')
      expect(url).toContain('scope=past')
    })
  })
})
