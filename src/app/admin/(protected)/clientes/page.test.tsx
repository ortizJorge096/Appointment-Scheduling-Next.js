// src/app/admin/(protected)/clientes/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClientesPage from './ClientesPageClient'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

const replace = vi.fn()
let currentSearch = ''
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ replace }),
  usePathname:     () => '/admin/clientes',
  useSearchParams: () => new URLSearchParams(currentSearch),
}))
// useCan() reads the session; SUPER_ADMIN so the row "Editar" affordances render
// (they gate on clientes:editar).
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'a1', role: 'SUPER_ADMIN' } }, status: 'authenticated' }),
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
  beforeEach(() => { vi.clearAllMocks(); currentSearch = '' })

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
    fireEvent.change(screen.getByPlaceholderText('3001234567'),      { target: { value: '3009998877' } })

    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/clients', expect.objectContaining({ method: 'POST' }))
    })

    const postCall = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === 'POST')
    const body = JSON.parse((postCall![1] as unknown as { body: string }).body)
    expect(body.name).toBe('María Ruiz')
    expect(body.email).toBe('maria@test.com')
    expect(body.phone).toBe('3009998877')
  })

  it('valida en el cliente: nombre numérico + sin teléfono NO dispara POST y muestra el error inline', async () => {
    const fetchMock = makeFetchMock()
    global.fetch = fetchMock as unknown as typeof fetch

    render(<ClientesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /\+ nuevo/i }))

    // Nombre solo-números + sin teléfono → el envío se bloquea en el cliente.
    fireEvent.change(screen.getByPlaceholderText('Ana García'), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }))

    // No hubo POST al API…
    const posted = fetchMock.mock.calls.some((c) => (c[1] as { method?: string })?.method === 'POST')
    expect(posted).toBe(false)
    // …y se ven los errores inline en español (no el mensaje crudo de Zod).
    expect(screen.getByText(/incluir letras/i)).toBeInTheDocument()
    expect(screen.getByText(/teléfono es requerido/i)).toBeInTheDocument()
  })
})

describe('ClientesPage — editar cliente', () => {
  beforeEach(() => { vi.clearAllMocks(); currentSearch = '' })

  // GET → one client; PATCH → the edited client. Lets the row (and its "Editar") render.
  function makeFetchWithClient() {
    return vi.fn((_url: string, opts?: { method?: string }) => {
      const method = opts?.method ?? 'GET'
      if (method === 'PATCH') {
        return Promise.resolve({ json: () => Promise.resolve({ success: true, data: { id: 'c1' } }) })
      }
      return Promise.resolve({
        json: () => Promise.resolve({
          success: true,
          data: {
            clients: [{
              id: 'c1', name: 'Ana García', email: 'ana@test.com', phone: '3001234567',
              notes: 'VIP', createdAt: '2026-06-01T10:00:00.000Z', deletedAt: null,
              _count: { appointments: 3 },
            }],
            pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        }),
      })
    })
  }

  it('abre el modal precargado y guarda vía PATCH /api/clients/:id', async () => {
    const fetchMock = makeFetchWithClient()
    global.fetch = fetchMock as unknown as typeof fetch

    render(<ClientesPage />)

    // Desktop + mobile both render an "Editar"; either opens the same modal.
    const editButtons = await screen.findAllByRole('button', { name: /^editar$/i })
    fireEvent.click(editButtons[0])

    // Edit mode: title switched and the form is prefilled from the row (no extra fetch).
    expect(screen.getByText('Editar cliente')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ana García')).toHaveValue('Ana García')
    expect(screen.getByPlaceholderText('3001234567')).toHaveValue('3001234567')

    fireEvent.change(screen.getByPlaceholderText('3001234567'), { target: { value: '3009998877' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/clients/c1', expect.objectContaining({ method: 'PATCH' }))
    })
    const patchCall = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === 'PATCH')
    const body = JSON.parse((patchCall![1] as unknown as { body: string }).body)
    expect(body.name).toBe('Ana García')
    expect(body.phone).toBe('3009998877')
  })
})

describe('ClientesPage — paginación y búsqueda en la URL', () => {
  beforeEach(() => { vi.clearAllMocks(); currentSearch = '' })

  it('lee page/search desde la URL al cargar', async () => {
    currentSearch = 'page=2&search=ana'
    const fetchMock = makeFetchMock()
    global.fetch = fetchMock as unknown as typeof fetch

    render(<ClientesPage />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('page=2')
    expect(calledUrl).toContain('search=ana')
    expect(screen.getByPlaceholderText('Buscar por nombre, email o teléfono…')).toHaveValue('ana')
  })

  it('al escribir en el buscador, actualiza la URL (sin page) tras el debounce', async () => {
    vi.useFakeTimers()
    global.fetch = makeFetchMock() as unknown as typeof fetch
    render(<ClientesPage />)

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, email o teléfono…'), {
      target: { value: 'maria' },
    })

    await vi.advanceTimersByTimeAsync(350)

    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('search=maria'),
      { scroll: false }
    )
    expect(replace).toHaveBeenCalledWith(
      expect.not.stringContaining('page='),
      { scroll: false }
    )
    vi.useRealTimers()
  })
})
