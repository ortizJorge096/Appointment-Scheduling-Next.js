// src/app/admin/(protected)/clientes/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClientesPage from './page'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

// fetch mock: GET → empty client list; POST → created client
function makeFetchMock() {
  return vi.fn((_url: string, opts?: { method?: string }) => {
    const method = opts?.method ?? 'GET'
    if (method === 'POST') {
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: { id: 'c1' } }) })
    }
    return Promise.resolve({
      json: () => Promise.resolve({
        success: true,
        data: { clients: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      }),
    })
  })
}

describe('ClientesPage — crear cliente', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('muestra el botón "+ Nuevo"', async () => {
    global.fetch = makeFetchMock() as unknown as typeof fetch
    render(<ClientesPage />)
    expect(await screen.findByRole('button', { name: /\+ nuevo/i })).toBeInTheDocument()
  })

  it('abre el modal y crea un cliente vía POST /api/clients', async () => {
    const fetchMock = makeFetchMock()
    global.fetch = fetchMock as unknown as typeof fetch

    render(<ClientesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /\+ nuevo/i }))

    // Modal abierto
    expect(screen.getByText('Nuevo cliente')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Ana García'),      { target: { value: 'María Ruiz' } })
    fireEvent.change(screen.getByPlaceholderText('ana@ejemplo.com'), { target: { value: 'maria@test.com' } })

    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ method: 'POST' }))
    })

    const postCall = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === 'POST')
    const body = JSON.parse((postCall![1] as unknown as { body: string }).body)
    expect(body.name).toBe('María Ruiz')
    expect(body.email).toBe('maria@test.com')
  })
})
