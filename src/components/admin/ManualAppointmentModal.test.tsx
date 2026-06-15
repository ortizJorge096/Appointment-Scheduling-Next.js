// src/components/admin/ManualAppointmentModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ManualAppointmentModal from './ManualAppointmentModal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const MOCK_SERVICES = [
  { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 },
  { id: 's2', name: 'Lifting', price: 80000, durationMinutes: 90 },
]

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

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 's1' } })

    const dateInputs = screen.getAllByDisplayValue('')
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '10:00' } })

    fireEvent.click(screen.getByRole('button', { name: /crear cita/i }))

    await waitFor(() => {
      expect(screen.getByText(/Este horario ya está ocupado/)).toBeInTheDocument()
    })
  })
})
