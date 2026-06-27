import { render, screen, waitFor } from '@testing-library/react'
import ConfirmacionClient from './ConfirmacionClient'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/config', () => ({ WHATSAPP_URL: 'https://wa.me/57300' }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=appt-123&token=tok-xyz'),
}))

const BASE = {
  id: 'appt-123',
  clientName: 'Ana',
  service: { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 },
  services: [],
  date: '2026-07-01T00:00:00.000Z',
  startTime: '10:00',
  endTime: '10:45',
  status: 'CONFIRMED',
  totalDurationMinutes: 45,
}

function mockAppointment(data: Record<string, unknown>) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, data }) })
  ) as unknown as typeof fetch
}

describe('ConfirmacionClient — cancel link visibility', () => {
  it('with email: shows the email message and HIDES the cancel link/token', async () => {
    mockAppointment({ ...BASE, clientEmail: 'ana@example.com' })
    render(<ConfirmacionClient />)

    expect(await screen.findByText(/ana@example.com/)).toBeInTheDocument()
    expect(screen.queryByText(/Guarda tu enlace para cancelar/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Enlace de cancelación')).not.toBeInTheDocument()
  })

  it('without email: shows the copyable cancel link and the warning', async () => {
    mockAppointment({ ...BASE, clientEmail: null })
    render(<ConfirmacionClient />)

    const input = await screen.findByLabelText('Enlace de cancelación')
    expect((input as HTMLInputElement).value).toContain('/cancelar?id=appt-123&token=tok-xyz')
    expect(screen.getByText(/No te llegará por correo/i)).toBeInTheDocument()
    // No "revisa tu email" copy when there is no email on file.
    expect(screen.queryByText(/Revisa tu bandeja/i)).not.toBeInTheDocument()
  })
})
