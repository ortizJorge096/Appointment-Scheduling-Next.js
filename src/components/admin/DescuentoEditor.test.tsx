// src/components/admin/DescuentoEditor.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import DescuentoEditor, { type DescuentoTipo } from './DescuentoEditor'

function setup(props: Partial<React.ComponentProps<typeof DescuentoEditor>> = {}) {
  const onAdd = vi.fn(), onRemove = vi.fn(), onChange = vi.fn()
  const base = {
    open: false, tipo: 'PORCENTAJE' as DescuentoTipo, valor: '', motivo: '',
    onAdd, onRemove, onChange,
  }
  render(<DescuentoEditor {...base} {...props} />)
  return { onAdd, onRemove, onChange }
}

describe('DescuentoEditor', () => {
  it('collapsed: shows "Agregar descuento" and calls onAdd', () => {
    const { onAdd } = setup({ open: false })
    fireEvent.click(screen.getByRole('button', { name: /agregar descuento/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('open: shows "Quitar descuento" and calls onRemove', () => {
    const { onRemove } = setup({ open: true })
    fireEvent.click(screen.getByRole('button', { name: /quitar descuento/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('toggling % / $ emits the tipo change', () => {
    const { onChange } = setup({ open: true, tipo: 'PORCENTAJE' })
    fireEvent.click(screen.getByRole('button', { name: '$' }))
    expect(onChange).toHaveBeenCalledWith({ tipo: 'VALOR_FIJO' })
  })

  it('emits valor and motivo changes', () => {
    const { onChange } = setup({ open: true })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } })
    expect(onChange).toHaveBeenCalledWith({ valor: '20' })
    fireEvent.change(screen.getByPlaceholderText(/motivo del descuento/i), { target: { value: 'Cliente frecuente' } })
    expect(onChange).toHaveBeenCalledWith({ motivo: 'Cliente frecuente' })
  })

  it('renders the error message when provided', () => {
    setup({ open: true, error: 'El descuento no puede superar el subtotal.' })
    expect(screen.getByText('El descuento no puede superar el subtotal.')).toBeInTheDocument()
  })
})
