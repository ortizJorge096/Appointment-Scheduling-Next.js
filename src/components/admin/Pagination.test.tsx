// src/components/admin/Pagination.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from './Pagination'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPage={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  describe('onPage mode (buttons)', () => {
    it('shows the current page and total', () => {
      render(<Pagination page={2} totalPages={5} onPage={vi.fn()} />)
      expect(screen.getByText('Página 2 de 5')).toBeInTheDocument()
    })

    it('disables "Anterior" on the first page and "Siguiente" on the last', () => {
      render(<Pagination page={1} totalPages={3} onPage={vi.fn()} />)
      expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /siguiente/i })).not.toBeDisabled()
    })

    it('calls onPage with the next/previous page number', () => {
      const onPage = vi.fn()
      render(<Pagination page={2} totalPages={5} onPage={onPage} />)
      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
      expect(onPage).toHaveBeenCalledWith(3)
      fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
      expect(onPage).toHaveBeenCalledWith(1)
    })
  })

  describe('hrefFor mode (links)', () => {
    it('renders links pointing at hrefFor(page ± 1)', () => {
      render(<Pagination page={2} totalPages={5} hrefFor={(p) => `/admin/citas?page=${p}`} />)
      expect(screen.getByRole('link', { name: /anterior/i })).toHaveAttribute('href', '/admin/citas?page=1')
      expect(screen.getByRole('link', { name: /siguiente/i })).toHaveAttribute('href', '/admin/citas?page=3')
    })

    it('renders a disabled, non-clickable marker instead of a link at the edges', () => {
      render(<Pagination page={1} totalPages={3} hrefFor={(p) => `/admin/citas?page=${p}`} />)
      expect(screen.queryByRole('link', { name: /anterior/i })).not.toBeInTheDocument()
      expect(screen.getByText('← Anterior')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /siguiente/i })).toBeInTheDocument()
    })
  })
})
