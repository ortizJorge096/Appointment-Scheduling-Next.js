import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BookingForm from './BookingForm'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock DateTimePicker — the real one makes API calls and has complex state
vi.mock('./DateTimePicker', () => ({
  default: ({ onTimeChange }: { onTimeChange: (t: string) => void }) => (
    <div>
      <button type="button" onClick={() => onTimeChange('10:00')}>10:00</button>
    </div>
  ),
}))

const MOCK_SERVICES = [
  { id: 'svc-1', name: 'Manicura', description: null, category: 'UNAS', price: 50000, durationMinutes: 60 },
]

const STORAGE_KEY = 'vj_booking_client'

function setupApiMocks() {
  globalThis.fetch = vi.fn((url: string) => {
    const u = typeof url === 'string' ? url : ''
    if (u === '/api/services') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ success: false }) })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  localStorage.clear()
  setupApiMocks()
  mockPush.mockClear()
})

async function navigateToInfoStep(user: ReturnType<typeof userEvent.setup>) {
  // Step 1 — category: click Uñas then Continuar
  const catBtn = await screen.findByText('Uñas')
  await user.click(catBtn)
  await user.click(screen.getByText(/Continuar/))

  // Step 2 — service: click Manicura, component auto-advances after 280ms
  const svcBtn = await screen.findByText('Manicura')
  await user.click(svcBtn)

  // Step 3 — datetime: click time slot then Continuar
  const timeBtn = await screen.findByText('10:00')
  await user.click(timeBtn)
  await user.click(screen.getByText(/Continuar/))

  // Step 4 — info
  await screen.findByPlaceholderText('Tu nombre y apellido')
}

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

  it('renderiza <datalist> con datos guardados al llegar al paso info', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      clientName: 'María López', clientEmail: 'maria@email.com', clientPhone: '3001112233',
    }))
    render(<BookingForm />)
    const user = userEvent.setup()
    await navigateToInfoStep(user)

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
    await navigateToInfoStep(user)

    const nameInput = await screen.findByPlaceholderText('Tu nombre y apellido')
    expect(nameInput).toHaveAttribute('list', 'dl-name')
    expect(screen.getByPlaceholderText('tu@email.com')).toHaveAttribute('list', 'dl-email')
    expect(screen.getByPlaceholderText('300 000 0000')).toHaveAttribute('list', 'dl-phone')
  })
})