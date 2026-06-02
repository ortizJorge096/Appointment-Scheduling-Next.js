import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Agendar</Button>)
    expect(screen.getByRole('button', { name: /agendar/i })).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    render(<Button>Click</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-gold')
  })

  it('applies secondary variant', () => {
    render(<Button variant="secondary">Click</Button>)
    expect(screen.getByRole('button').className).toContain('border-ink')
  })

  it('applies danger variant', () => {
    render(<Button variant="danger">Eliminar</Button>)
    expect(screen.getByRole('button').className).toContain('text-red-500')
  })

  it('applies size classes', () => {
    const { rerender } = render(<Button size="sm">Sm</Button>)
    expect(screen.getByRole('button').className).toContain('px-4 py-2')
    rerender(<Button size="lg">Lg</Button>)
    expect(screen.getByRole('button').className).toContain('px-8')
  })

  it('disables the button', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick handler', async () => {
    const fn = vi.fn()
    render(<Button onClick={fn}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('forwards ref', () => {
    const ref = vi.fn()
    render(<Button ref={ref}>Ref</Button>)
    expect(ref).toHaveBeenCalled()
  })

  it('merges className', () => {
    render(<Button className="extra-class">Styled</Button>)
    expect(screen.getByRole('button').className).toContain('extra-class')
  })
})
