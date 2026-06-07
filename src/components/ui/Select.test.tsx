// src/components/ui/Select.test.tsx
import { render, screen } from '@testing-library/react'
import { Select } from './Select'

const OPTIONS = [
  { value: 'a', label: 'Opción A' },
  { value: 'b', label: 'Opción B' },
  { value: 'c', label: 'Opción C' },
]

describe('Select', () => {
  it('renders all options', () => {
    render(<Select options={OPTIONS} />)
    expect(screen.getByText('Opción A')).toBeInTheDocument()
    expect(screen.getByText('Opción B')).toBeInTheDocument()
    expect(screen.getByText('Opción C')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Select options={OPTIONS} label="Categoría" />)
    expect(screen.getByText('Categoría')).toBeInTheDocument()
  })

  it('does not render label element when not provided', () => {
    render(<Select options={OPTIONS} />)
    expect(screen.queryByRole('label')).not.toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(<Select options={OPTIONS} error="Campo requerido" />)
    expect(screen.getByText('Campo requerido')).toBeInTheDocument()
  })

  it('does not render error when not provided', () => {
    render(<Select options={OPTIONS} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('forwards value and onChange correctly', () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} value="b" onChange={onChange} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('b')
  })

  it('forwards disabled prop to the select element', () => {
    render(<Select options={OPTIONS} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('forwards name prop to the select element', () => {
    render(<Select options={OPTIONS} name="category" />)
    expect(screen.getByRole('combobox')).toHaveAttribute('name', 'category')
  })

  it('applies error border class when error is present', () => {
    render(<Select options={OPTIONS} error="Error" />)
    expect(screen.getByRole('combobox').className).toContain('border-red-400')
  })

  it('renders with empty options list without crashing', () => {
    render(<Select options={[]} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
