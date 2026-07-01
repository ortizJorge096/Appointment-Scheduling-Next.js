// src/app/admin/(protected)/citas/[id]/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CitaDetailPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'a1' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
// usePermissionGuard + useCan read the session; SUPER_ADMIN has all permissions,
// so the guard never redirects and pago/cancelar/editar controls all render.
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'a1', role: 'SUPER_ADMIN' } }, status: 'authenticated' }),
}))

const APPT = {
  id: 'a1',
  clientName: 'Ana López', clientEmail: 'ana@test.com', clientPhone: '3001234567',
  clientId: 'c1', date: '2026-12-01T12:00:00.000Z', startTime: '10:00', endTime: '10:45',
  status: 'CONFIRMED', source: 'PRESENCIAL',
  paymentStatus: 'PENDING', paymentMethod: null, amountPaid: null,
  notes: null, confirmationSentAt: null, reminderSentAt: null,
  cancelToken: 'tok', calendarEventId: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  totalDurationMinutes: 45,
  service: { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 },
  services: [],
}

function makeFetchMock() {
  return vi.fn((_url: string, opts?: { method?: string }) => {
    const method = opts?.method ?? 'GET'
    if (method === 'PATCH') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: { ...APPT, paymentStatus: 'PAID', amountPaid: 35000, paymentMethod: 'EFECTIVO' } }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: true, data: APPT }) })
  })
}

describe('CitaDetailPage — pago', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('marca pagado (total) y guarda el pago vía PATCH', async () => {
    const fetchMock = makeFetchMock()
    global.fetch = fetchMock as unknown as typeof fetch

    render(<CitaDetailPage />)

    // Espera a que cargue la cita (el nombre está en el breadcrumb y en el h1; uso el heading)
    await screen.findByRole('heading', { name: 'Ana López' })

    fireEvent.click(screen.getByRole('button', { name: /marcar pagado/i }))

    // Wait for React state to flush (the amount input should reflect the full price)
    await screen.findByDisplayValue('35000')

    fireEvent.click(screen.getByRole('button', { name: /guardar pago/i }))

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === 'PATCH')
      expect(patch).toBeTruthy()
      const body = JSON.parse((patch![1] as unknown as { body: string }).body)
      expect(body.paymentStatus).toBe('PAID')
      expect(body.amountPaid).toBe(35000)
      expect(body.paymentMethod).toBe('EFECTIVO')
    })
  })
})
