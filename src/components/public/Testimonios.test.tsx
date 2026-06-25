import { render, screen, waitFor } from '@testing-library/react'
import Testimonios from './Testimonios'

const MOCK = [
  { id: 't1', clientName: 'Carmen Morales', initials: 'C.M.', type: 'Clienta frecuente', text: 'Excelente atención', stars: 5, imageUrl: null },
  { id: 't2', clientName: 'Diana Ruiz', initials: 'D.R.', type: 'Clienta VIP', text: 'Me encantó el resultado', stars: 4, imageUrl: 'https://bucket.s3.amazonaws.com/testimonios/x.jpg' },
]

function mockFetch(data: unknown) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, data }) })
  ) as unknown as typeof fetch
}

describe('Testimonios', () => {
  it('renderiza los testimonios aprobados que devuelve la API', async () => {
    mockFetch(MOCK)
    render(<Testimonios />)

    expect(await screen.findByText('Carmen Morales')).toBeInTheDocument()
    expect(screen.getByText('Clienta frecuente')).toBeInTheDocument()
    expect(screen.getByText('C.M.')).toBeInTheDocument()
    expect(screen.getByText(/Me encantó el resultado/)).toBeInTheDocument()
  })

  it('muestra la imagen del trabajo cuando el testimonio tiene foto', async () => {
    mockFetch(MOCK)
    render(<Testimonios />)
    expect(await screen.findByAltText('Trabajo de Diana Ruiz')).toBeInTheDocument()
  })

  it('oculta la sección cuando no hay testimonios', async () => {
    mockFetch([])
    render(<Testimonios />)
    await waitFor(() => expect(screen.queryByText('Testimonios')).toBeNull())
  })

  it('oculta la sección si la petición falla', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch
    render(<Testimonios />)
    await waitFor(() => expect(screen.queryByText('Testimonios')).toBeNull())
  })
})
