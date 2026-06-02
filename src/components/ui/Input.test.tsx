import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Input label="Nombre" />)
    expect(screen.getByText('Nombre')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<Input error="Campo requerido" />)
    expect(screen.getByText('Campo requerido')).toBeInTheDocument()
  })

  it('applies error border class', () => {
    render(<Input error="Error" />)
    expect(screen.getByRole('textbox').className).toContain('border-red-400')
  })

  it('forwards input value', async () => {
    render(<Input label="Email" />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'test@example.com')
    expect(input).toHaveValue('test@example.com')
  })

  it('renders dark variant', () => {
    render(<Input dark />)
    expect(screen.getByRole('textbox').className).toContain('input-dark')
  })

  it('forwards ref', () => {
    const ref = vi.fn()
    render(<Input ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })
})
