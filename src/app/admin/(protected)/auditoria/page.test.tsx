// src/app/admin/(protected)/auditoria/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuditoriaPage from './AuditoriaPageClient'

const replace = vi.fn()
let currentSearch = ''

vi.mock('next/navigation', () => ({
  useRouter:      () => ({ replace }),
  usePathname:    () => '/admin/auditoria',
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

function makeFetchMock() {
  return vi.fn(() => Promise.resolve({
    json: () => Promise.resolve({
      success: true,
      data: { logs: [], pagination: { total: 0, page: 1, totalPages: 1 } },
    }),
  }))
}

describe('AuditoriaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSearch = ''
  })

  it('reads filters and page from the URL on load', async () => {
    currentSearch = 'entity=CLIENT&action=CREATE&page=3'
    global.fetch = makeFetchMock() as unknown as typeof fetch
    render(<AuditoriaPage />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('entity=CLIENT')
      )
    })
    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('action=CREATE')
    expect(calledUrl).toContain('page=3')
  })

  it('updates the URL (page=1) and refetches when a filter changes', async () => {
    global.fetch = makeFetchMock() as unknown as typeof fetch
    render(<AuditoriaPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const [entitySelect] = screen.getAllByRole('combobox')
    fireEvent.change(entitySelect, { target: { value: 'CLIENT' } })

    expect(replace).toHaveBeenCalledWith(
      expect.stringContaining('entity=CLIENT'),
      { scroll: false }
    )
    expect(replace).toHaveBeenCalledWith(
      expect.not.stringContaining('page='),
      { scroll: false }
    )
  })

  it('"Limpiar filtros" resets the URL to the bare pathname', async () => {
    currentSearch = 'entity=CLIENT&page=2'
    global.fetch = makeFetchMock() as unknown as typeof fetch
    render(<AuditoriaPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }))
    expect(replace).toHaveBeenCalledWith('/admin/auditoria', { scroll: false })
  })
})
