// src/components/admin/ManualAppointmentModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ManualAppointmentModal from './ManualAppointmentModal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
// useCan() reads the session; provide an authenticated SUPER_ADMIN so every control renders.
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'a1', role: 'SUPER_ADMIN' } }, status: 'authenticated' }),
}))

const MOCK_SERVICES = [
  { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 },
  { id: 's2', name: 'Lifting', price: 80000, durationMinutes: 90 },
]

// A valid "past" date for backfill. The modal only accepts up to PAST_LIMIT_DAYS
// (15) days ago, so a far date like 2020-01-01 is rejected by validation and the
// submit is blocked. Compute a date safely inside the window (and relative to
// "today" so the test never goes stale).
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('ManualAppointmentModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('renders the trigger button', () => {
    render(<ManualAppointmentModal />)
    expect(screen.getByRole('button', { name: /cita manual/i })).toBeInTheDocument()
  })

  it('modal is closed by default', () => {
    render(<ManualAppointmentModal />)
    expect(screen.queryByText('Nueva cita manual')).not.toBeInTheDocument()
  })

  it('opens modal on button click and loads services', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }),
    } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))

    expect(screen.getByText('Nueva cita manual')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/Manicura/)).toBeInTheDocument()
    })
  })

  it('closes modal when cancel button is clicked', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: [] }),
    } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    expect(screen.getByText('Nueva cita manual')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.queryByText('Nueva cita manual')).not.toBeInTheDocument()
  })

  it('shows source options (Presencial, WhatsApp, Teléfono, Online)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: [] }),
    } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Presencial' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Teléfono' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Online' })).toBeInTheDocument()
    })
  })

  it('searches existing clients and prefills the form when one is picked', async () => {
    vi.mocked(global.fetch)
      // services (on open)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) } as Response)
      // client search
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { clients: [{ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '3001234567', _count: { appointments: 3 } }] },
        }),
      } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'ana' } })

    // Debounced fetch resolves → result appears; clicking it prefills the fields
    const result = await screen.findByText('Ana López')
    fireEvent.click(result)

    expect(screen.getByPlaceholderText('Ana García')).toHaveValue('Ana López')
    expect(screen.getByPlaceholderText('ana@ejemplo.com')).toHaveValue('ana@test.com')
    expect(screen.getByPlaceholderText('3001234567')).toHaveValue('3001234567')
  })

  it('muestra el conteo de citas previas en los resultados de búsqueda', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: { clients: [{ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '3001234567', _count: { appointments: 5 } }] },
        }),
      } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'ana' } })

    await screen.findByText('Ana López')
    expect(screen.getByText('ana@test.com · 5 citas')).toBeInTheDocument()
  })

  it('"Crear cliente nuevo" precarga el nombre escrito y enfoca el email', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) } as Response)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { clients: [] } }),
      } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'Carla Nueva' } })

    const createNewButton = await screen.findByRole('button', { name: '+ Crear cliente nuevo' })
    fireEvent.click(createNewButton)

    const emailInput = screen.getByPlaceholderText('ana@ejemplo.com')
    expect(screen.getByPlaceholderText('Ana García')).toHaveValue('Carla Nueva')
    expect(emailInput).toHaveFocus()
  })

  it('shows error message on API failure', async () => {
    // Load services
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) } as Response)
      // Submit appointment → error
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: false, error: 'Este horario ya está ocupado.' }) } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText('Ana García'),       { target: { value: 'Ana López' } })
    fireEvent.change(screen.getByPlaceholderText('ana@ejemplo.com'),  { target: { value: 'ana@test.com' } })
    fireEvent.change(screen.getByPlaceholderText('3001234567'),       { target: { value: '3001234567' } })

    fireEvent.click(screen.getByRole('checkbox', { name: /Manicura/i }))

    // Robust selection by accessible label (no fragile index lookup)
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Hora'),  { target: { value: '10:00' } })

    fireEvent.click(screen.getByRole('button', { name: /crear cita/i }))

    await waitFor(() => {
      expect(screen.getByText(/Este horario ya está ocupado/)).toBeInTheDocument()
    })
  })

  it('premarca "Notificar al cliente" según el origen seleccionado', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }),
    } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    // The pre-check only applies with an email in the field (no email → the checkbox is locked)
    fireEvent.change(screen.getByPlaceholderText('ana@ejemplo.com'), { target: { value: 'ana@test.com' } })

    const checkbox = screen.getByRole('checkbox', { name: /notificar al cliente por email/i })
    // Default source is Presencial → unchecked
    expect(checkbox).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }))
    expect(checkbox).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Presencial' }))
    expect(checkbox).not.toBeChecked()
  })

  it('deshabilita "Notificar al cliente" cuando no hay email', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }),
    } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    // Without an email, the notification checkbox is disabled
    const checkbox = screen.getByRole('checkbox', { name: /notificar al cliente por email/i })
    expect(checkbox).toBeDisabled()

    // Al escribir un email, se habilita
    fireEvent.change(screen.getByPlaceholderText('ana@ejemplo.com'), { target: { value: 'ana@test.com' } })
    expect(checkbox).not.toBeDisabled()
  })

  it('bloquea el envío (no llama al API) cuando faltan datos requeridos', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }),
    } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    // Submit with an empty form → validation must block the POST to the API.
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }))

    await waitFor(() => {
      const posted = vi.mocked(global.fetch).mock.calls
        .some((c) => String(c[0]).includes('/api/appointments/manual'))
      expect(posted).toBe(false)
    })
    // Modal stays open (submission was blocked, not silently swallowed).
    expect(screen.getByText('Nueva cita manual')).toBeInTheDocument()
  })

  it('en "Cita pasada" captura el método de pago y lo manda en el payload', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: MOCK_SERVICES }) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: { id: 'apt-1' } }) } as Response)

    render(<ManualAppointmentModal />)
    fireEvent.click(screen.getByRole('button', { name: /cita manual/i }))
    await waitFor(() => screen.getByText(/Manicura/))

    // Switch to "Cita pasada" → the payment-method selector must appear.
    fireEvent.click(screen.getByRole('button', { name: 'Cita pasada' }))
    expect(screen.getByRole('button', { name: 'Nequi' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Ana García'), { target: { value: 'Ana López' } })
    fireEvent.change(screen.getByPlaceholderText('3001234567'), { target: { value: '3001234567' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Manicura/i }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: daysAgo(2) } }) // within the 15-day backfill window
    fireEvent.change(screen.getByLabelText('Hora'),  { target: { value: '10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nequi' }))

    fireEvent.click(screen.getByRole('button', { name: 'Registrar cita pasada' }))

    await waitFor(() => {
      const post = vi.mocked(global.fetch).mock.calls
        .find((c) => String(c[0]).includes('/api/appointments/manual'))
      expect(post).toBeDefined()
      const body = JSON.parse((post![1] as RequestInit).body as string)
      expect(body.mode).toBe('PAST')
      expect(body.paymentMethod).toBe('NEQUI')
    })
  })
})
