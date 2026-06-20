import { render, screen } from '@testing-library/react'
import Galeria from './Galeria'
import { STUDIO, INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'

const MOCK_IMAGES = [
  { id: 'img-1', url: 'https://bucket.s3.amazonaws.com/img1.jpg', title: 'Nail art', description: null, category: 'UNAS' },
  { id: 'img-2', url: 'https://bucket.s3.amazonaws.com/img2.jpg', title: null, description: null, category: null },
]

function mockFetch(data: unknown) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, data }) })
  ) as unknown as typeof fetch
}

describe('Galeria', () => {
  it('los links a redes sociales están bien formados', () => {
    expect(INSTAGRAM_URL).toContain(STUDIO.instagram)
    expect(INSTAGRAM_URL).toMatch(/^https:\/\/(www\.)?instagram\.com\//)

    expect(TIKTOK_URL).toContain(STUDIO.tiktok)
    expect(TIKTOK_URL).toMatch(/^https:\/\/(www\.)?tiktok\.com\//)
  })

  it('muestra las imágenes reales devueltas por /api/gallery', async () => {
    mockFetch(MOCK_IMAGES)
    render(<Galeria />)
    expect(await screen.findByAltText('Nail art')).toHaveAttribute('src', MOCK_IMAGES[0].url)
    expect(await screen.findByAltText('Diseño')).toHaveAttribute('src', MOCK_IMAGES[1].url)
  })

  it('cae a los gradientes placeholder cuando no hay imágenes activas', async () => {
    mockFetch([])
    render(<Galeria />)
    expect(await screen.findByText('Volumen brasilero')).toBeInTheDocument()
  })

  it('cae a los gradientes placeholder si la petición falla', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network error'))) as unknown as typeof fetch
    render(<Galeria />)
    expect(await screen.findByText('Volumen brasilero')).toBeInTheDocument()
  })
})
