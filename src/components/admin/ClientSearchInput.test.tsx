// src/components/admin/ClientSearchInput.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClientSearchInput from './ClientSearchInput'

function mockSearchResponse(clients: Array<{ id: string; name: string; email: string; phone: string | null; appointments: number }>) {
  return {
    json: () => Promise.resolve({
      success: true,
      data: { clients: clients.map((c) => ({ ...c, _count: { appointments: c.appointments } })) },
    }),
  } as Response
}

describe('ClientSearchInput', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('no busca con menos de 2 caracteres', async () => {
    render(<ClientSearchInput onSelect={vi.fn()} onCreateNew={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'a' } })
    await new Promise((r) => setTimeout(r, 350))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('busca con debounce de 300ms y pasa limit=8', async () => {
    vi.useFakeTimers()
    vi.mocked(global.fetch).mockResolvedValue(mockSearchResponse([]))

    render(<ClientSearchInput onSelect={vi.fn()} onCreateNew={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'ana' } })

    expect(global.fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/clients?search=ana&limit=8'))
    vi.useRealTimers()
  })

  it('muestra resultados con nombre, email y conteo de citas', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockSearchResponse([{ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '300', appointments: 3 }])
    )

    render(<ClientSearchInput onSelect={vi.fn()} onCreateNew={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'ana' } })

    await screen.findByText('Ana López')
    expect(screen.getByText('ana@test.com · 3 citas')).toBeInTheDocument()
  })

  it('muestra "No encontrado" cuando no hay resultados, con la opción de crear cliente', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(mockSearchResponse([]))

    render(<ClientSearchInput onSelect={vi.fn()} onCreateNew={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'zzz' } })

    await screen.findByText('No encontrado')
    expect(screen.getByRole('button', { name: '+ Crear cliente nuevo' })).toBeInTheDocument()
  })

  it('selecciona un cliente al hacer click y limpia el query', async () => {
    const onSelect = vi.fn()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockSearchResponse([{ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '300', appointments: 0 }])
    )

    render(<ClientSearchInput onSelect={onSelect} onCreateNew={vi.fn()} />)
    const input = screen.getByLabelText('Buscar cliente existente')
    fireEvent.change(input, { target: { value: 'ana' } })

    fireEvent.click(await screen.findByText('Ana López'))

    expect(onSelect).toHaveBeenCalledWith({ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '300', appointmentCount: 0 })
    expect(input).toHaveValue('')
  })

  it('llama a onCreateNew con el texto escrito al hacer click en "Crear cliente nuevo"', async () => {
    const onCreateNew = vi.fn()
    vi.mocked(global.fetch).mockResolvedValueOnce(mockSearchResponse([]))

    render(<ClientSearchInput onSelect={vi.fn()} onCreateNew={onCreateNew} />)
    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'nueva cliente' } })

    fireEvent.click(await screen.findByRole('button', { name: '+ Crear cliente nuevo' }))
    expect(onCreateNew).toHaveBeenCalledWith('nueva cliente')
  })

  it('navega con flechas y selecciona con Enter', async () => {
    const onSelect = vi.fn()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockSearchResponse([
        { id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '300', appointments: 0 },
        { id: 'c2', name: 'Beatriz Ruiz', email: 'bea@test.com', phone: '301', appointments: 0 },
      ])
    )

    render(<ClientSearchInput onSelect={onSelect} onCreateNew={vi.fn()} />)
    const input = screen.getByLabelText('Buscar cliente existente')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.change(input, { target: { value: 'an' } })

    await screen.findByText('Ana López')

    // Empieza en el primer resultado; bajar una vez selecciona el segundo
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }))
  })

  it('cierra el dropdown con Escape', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockSearchResponse([{ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '300', appointments: 0 }])
    )

    render(<ClientSearchInput onSelect={vi.fn()} onCreateNew={vi.fn()} />)
    const input = screen.getByLabelText('Buscar cliente existente')
    fireEvent.change(input, { target: { value: 'ana' } })

    await screen.findByText('Ana López')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
  })

  it('cierra el dropdown al hacer click afuera', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockSearchResponse([{ id: 'c1', name: 'Ana López', email: 'ana@test.com', phone: '300', appointments: 0 }])
    )

    render(
      <div>
        <ClientSearchInput onSelect={vi.fn()} onCreateNew={vi.fn()} />
        <button>fuera</button>
      </div>
    )
    fireEvent.change(screen.getByLabelText('Buscar cliente existente'), { target: { value: 'ana' } })

    await screen.findByText('Ana López')
    fireEvent.mouseDown(screen.getByText('fuera'))

    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
  })
})
