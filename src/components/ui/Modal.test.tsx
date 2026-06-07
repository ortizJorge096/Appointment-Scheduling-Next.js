// src/components/ui/Modal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders nothing when open is false', () => {
    render(<Modal open={false} onClose={vi.fn()}>Content</Modal>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders children when open is true', () => {
    render(<Modal open onClose={vi.fn()}>Content</Modal>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Modal open onClose={vi.fn()} title="Mi título">Content</Modal>)
    expect(screen.getByText('Mi título')).toBeInTheDocument()
  })

  it('does not render title element when title is not provided', () => {
    render(<Modal open onClose={vi.fn()}>Content</Modal>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="Modal">Content</Modal>)
    await userEvent.click(screen.getByLabelText('Cerrar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    const { container } = render(<Modal open onClose={onClose}>Content</Modal>)
    // El backdrop es el primer div hijo del fixed container
    const backdrop = container.querySelector('.absolute.inset-0')!
    await userEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose}>Content</Modal>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose on non-Escape key press', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose}>Content</Modal>)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal open onClose={vi.fn()}>Content</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('resets body overflow when closed', () => {
    const { rerender } = render(<Modal open onClose={vi.fn()}>Content</Modal>)
    rerender(<Modal open={false} onClose={vi.fn()}>Content</Modal>)
    expect(document.body.style.overflow).toBe('')
  })

  it.each(['sm', 'md', 'lg'] as const)('renders with maxWidth=%s without errors', (maxWidth) => {
    render(<Modal open onClose={vi.fn()} maxWidth={maxWidth}>Content</Modal>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
