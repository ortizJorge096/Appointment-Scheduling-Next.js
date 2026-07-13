import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingForm from './BookingForm'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock DateTimePicker — the real one makes API calls and has complex state
vi.mock('./DateTimePicker', () => ({
  default: ({ onTimeChange }: { onTimeChange: (t: string) => void; serviceId?: string; durationMinutes?: number }) => (
    <div>
      <button type="button" onClick={() => onTimeChange('10:00')}>10:00</button>
    </div>
  ),
}))

const MOCK_SERVICES = [
  { id: 'svc-1', name: 'Manicura tradicional', description: null, categoryId: 'cat-unas', price: 50000, durationMinutes: 60 },
]

const MOCK_CATEGORIES = [
  { id: 'cat-unas', name: 'Uñas', slug: 'UNAS', description: 'Manicura y más', icon: 'manicura', order: 1 },
]

const MOCK_PROFESSIONALS = [
  { id: 'pro-1', name: 'Valentina J.', specialty: 'Especialista master', rating: 4.9, reviewCount: 1200 },
]

const STORAGE_KEY = 'vj_booking_client'

function setupApiMocks() {
  globalThis.fetch = vi.fn((url: string) => {
    const u = typeof url === 'string' ? url : ''
    if (u === '/api/services') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) })
    }
    if (u === '/api/categories') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: MOCK_CATEGORIES }) })
    }
    if (u === '/api/professionals') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: MOCK_PROFESSIONALS }) })
    }
    if (u === '/api/availability/today') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: { remaining: 3 } }) })
    }
    if (u === '/api/booking-settings') {
      // Enable the professional step so navigateToConfirmStep can walk all 4 steps.
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: { showProfessionalStep: true, maxAdvanceDays: 90 } }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  localStorage.clear()
  setupApiMocks()
  mockPush.mockClear()
})

async function navigateToConfirmStep(user: ReturnType<typeof userEvent.setup>) {
  // Step 1a — category
  const catBtn = await screen.findByText('Uñas')
  await user.click(catBtn)

  // Step 1b — service
  const svcBtn = await screen.findByText('Manicura tradicional')
  await user.click(svcBtn)
  await user.click(screen.getByText(/Continuar/))

  // Step 2 — professional
  await screen.findByText('Elige tu profesional')
  await user.click(screen.getByText(/Continuar/))

  // Step 3 — datetime
  const timeBtn = await screen.findByText('10:00')
  await user.click(timeBtn)
  await user.click(screen.getByText(/Continuar/))

  // Step 4 — confirm
  await screen.findByPlaceholderText('Tu nombre y apellido')
}

describe('BookingForm — datos persistidos', () => {
  it('arranca en el paso de categorías', async () => {
    render(<BookingForm />)
    expect(await screen.findByText('Uñas')).toBeInTheDocument()
  })

  it('muestra el badge de cupos para hoy en el paso servicio', async () => {
    render(<BookingForm />)
    await screen.findByText('Uñas')
    expect(await screen.findByText(/Quedan 3 cupos para hoy/)).toBeInTheDocument()
  })

  it('no auto-rellena los campos cuando hay datos guardados', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      clientName: 'María López', clientEmail: 'maria@email.com', clientPhone: '3001112233',
    }))
    render(<BookingForm />)
    await screen.findByText('Uñas')
    expect(screen.queryByDisplayValue('María López')).not.toBeInTheDocument()
  })

  it('renderiza <datalist> con datos guardados al llegar al paso confirmar', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      clientName: 'María López', clientEmail: 'maria@email.com', clientPhone: '3001112233',
    }))
    render(<BookingForm />)
    const user = userEvent.setup()
    await navigateToConfirmStep(user)

    await waitFor(() => {
      const option = document.querySelector('#dl-name option')
      expect(option).toBeInTheDocument()
      expect(option).toHaveValue('María López')
    })
    expect(document.querySelector('#dl-email option')).toHaveValue('maria@email.com')
    expect(document.querySelector('#dl-phone option')).toHaveValue('3001112233')
  })

  it('los inputs del paso confirmar tienen atributo list apuntando al datalist', async () => {
    render(<BookingForm />)
    const user = userEvent.setup()
    await navigateToConfirmStep(user)

    const nameInput = await screen.findByPlaceholderText('Tu nombre y apellido')
    expect(nameInput).toHaveAttribute('list', 'dl-name')
    expect(screen.getByPlaceholderText('tu@email.com')).toHaveAttribute('list', 'dl-email')
    expect(screen.getByPlaceholderText('300 000 0000')).toHaveAttribute('list', 'dl-phone')
  })
})

describe('BookingForm — bloqueo de reserva', () => {
  it('muestra el mensaje y el CTA de WhatsApp cuando el cliente está inactivo (403)', async () => {
    render(<BookingForm />)
    const user = userEvent.setup()
    await navigateToConfirmStep(user)

    // From here on, the phone lookup and the booking POST use this mock.
    globalThis.fetch = vi.fn((url: string, opts?: RequestInit) => {
      if (url === '/api/appointments' && opts?.method === 'POST') {
        return Promise.resolve({
          status: 403,
          json: () => Promise.resolve({
            success: false,
            error:   'Tu perfil está inactivo. Escríbenos por WhatsApp para agendar tu cita.',
            code:    'CLIENT_INACTIVE',
          }),
        })
      }
      return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
    }) as unknown as typeof fetch

    await user.type(screen.getByPlaceholderText('300 000 0000'), '3001234567')
    await user.type(screen.getByPlaceholderText('Tu nombre y apellido'), 'Ana López')
    await user.click(screen.getByText('Confirmar cita'))

    // The message is shown and a WhatsApp CTA is offered.
    expect(await screen.findByText(/perfil está inactivo/i)).toBeInTheDocument()
    const link = screen.getByText('Escribir por WhatsApp').closest('a')
    expect(link?.getAttribute('href')).toContain('wa.me')
  })
})
