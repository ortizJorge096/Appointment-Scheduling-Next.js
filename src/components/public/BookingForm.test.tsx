import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingForm from './BookingForm'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter:      () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

const MOCK_SERVICES = [
  { id: 'svc-1', name: 'Manicura', description: null, category: 'UNAS', price: 50000, durationMinutes: 60 },
]

const STORAGE_KEY = 'vj_booking_client'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function setupApiMocks() {
  globalThis.fetch = vi.fn((url: string) => {
    const u = typeof url === 'string' ? url : ''
    if (u === '/api/services') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) })
    }
    if (u.startsWith('/api/availability/range')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          data: { dates: [{ date: todayStr(), open: true }] },
        }),
      })
    }
    if (u.startsWith('/api/availability?')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          data: [{ start: '10:00', end: '11:00' }],
        }),
      })
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  localStorage.clear()
  setupApiMocks()
  mockPush.mockClear()
})

describe('BookingForm — datos persistidos', () => {
  it('arranca en el paso categoría', async () => {
    render(<BookingForm />)
    expect(await screen.findByText('Uñas')).toBeInTheDocument()
  })

  it('no auto-rellena los campos cuando hay datos guardados', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      clientName: 'María López', clientEmail: 'maria@email.com', clientPhone: '3001112233',
    }))

    render(<BookingForm />)
    await screen.findByText('Uñas')

    expect(screen.queryByDisplayValue('María López')).not.toBeInTheDocument()
  })

  it('renderiza <datalist> con datos guardados después del montaje', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      clientName: 'María López', clientEmail: 'maria@email.com', clientPhone: '3001112233',
    }))

    render(<BookingForm />)

    await waitFor(() => {
      const option = document.querySelector('#dl-name option')
      expect(option).toBeInTheDocument()
      expect(option).toHaveValue('María López')
    })

    expect(document.querySelector('#dl-email option')).toHaveValue('maria@email.com')
    expect(document.querySelector('#dl-phone option')).toHaveValue('3001112233')
  })

  it('los inputs del paso info tienen atributo list apuntando al datalist', async () => {
    render(<BookingForm />)
    const user = userEvent.setup()

    const catBtn = await screen.findByText('Uñas')
    await user.click(catBtn)

    const svcBtn = await screen.findByText('Manicura')
    await user.click(svcBtn)

    const timeBtn = await screen.findByText('10:00')
    await user.click(timeBtn)

    const continueBtn = await screen.findByText(/Continuar/)
    await user.click(continueBtn)

    const nameInput = await screen.findByPlaceholderText('Tu nombre y apellido')
    expect(nameInput).toHaveAttribute('list', 'dl-name')
    expect(screen.getByPlaceholderText('tu@email.com')).toHaveAttribute('list', 'dl-email')
    expect(screen.getByPlaceholderText('300 000 0000')).toHaveAttribute('list', 'dl-phone')
  })
})
