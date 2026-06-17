import { render, screen } from '@testing-library/react'
import GaleriaAdminPage from './page'

const MOCK_IMAGES = [
  {
    id: 'img-1',
    title: 'Diseño floral',
    description: 'Set completo de uñas',
    category: 'MANICURA',
    width: 800,
    height: 800,
    order: 1,
    isActive: true,
    url: 'https://bucket.s3.amazonaws.com/img1.jpg',
    s3Key: 'gallery/img1.jpg',
  },
  {
    id: 'img-2',
    title: null,
    description: null,
    category: null,
    width: null,
    height: null,
    order: 2,
    isActive: false,
    url: 'https://bucket.s3.amazonaws.com/img2.jpg',
    s3Key: 'gallery/img2.jpg',
  },
]

function setupApiMocks() {
  globalThis.fetch = vi.fn((url: string, opts?: RequestInit) => {
    const u = typeof url === 'string' ? url : ''
    if (u === '/api/gallery' && (!opts || opts.method === undefined || opts.method === 'GET')) {
      return Promise.resolve({
        json: () => Promise.resolve({ success: true, data: MOCK_IMAGES }),
      })
    }
    return Promise.resolve({
      json: () => Promise.resolve({ success: true, data: {} }),
    })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  setupApiMocks()
})

describe('GaleriaAdminPage', () => {
  it('renderiza el título y botón de subir', async () => {
    render(<GaleriaAdminPage />)
    expect(screen.getByText('Galería')).toBeInTheDocument()
    expect(screen.getByText('+ Subir imagen')).toBeInTheDocument()
  })

  it('carga y muestra las imágenes', async () => {
    render(<GaleriaAdminPage />)
    expect(await screen.findByText('Diseño floral')).toBeInTheDocument()
  })

  it('muestra "Sin título" para imágenes sin título', async () => {
    render(<GaleriaAdminPage />)
    await screen.findByText('Manicura')
    expect(screen.getByText('Sin título')).toBeInTheDocument()
  })

  it('muestra la categoría de la imagen', async () => {
    render(<GaleriaAdminPage />)
    await screen.findByText('Manicura')
    expect(screen.getByText('Manicura')).toBeInTheDocument()
  })

  it('renderiza botón "Imagen" para reemplazar en cada imagen', async () => {
    render(<GaleriaAdminPage />)
    const replaceBtns = await screen.findAllByText('Imagen')
    expect(replaceBtns).toHaveLength(2)
  })

  it('renderiza botón Editar en cada imagen', async () => {
    render(<GaleriaAdminPage />)
    await screen.findByText('Manicura')
    expect(screen.getAllByText('Editar')).toHaveLength(2)
  })

  it('renderiza Ocultar para imagen activa y Mostrar para inactiva', async () => {
    render(<GaleriaAdminPage />)
    await screen.findByText('Manicura')
    expect(screen.getByText('Ocultar')).toBeInTheDocument()
    expect(screen.getByText('Mostrar')).toBeInTheDocument()
  })

  it('renderiza botón Borrar en cada imagen', async () => {
    render(<GaleriaAdminPage />)
    await screen.findByText('Manicura')
    expect(screen.getAllByText('Borrar')).toHaveLength(2)
  })
})
