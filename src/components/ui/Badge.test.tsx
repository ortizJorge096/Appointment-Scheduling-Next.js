import { render, screen } from '@testing-library/react'
import { Badge, statusToBadge, STATUS_LABEL } from './Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Pendiente</Badge>)
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('applies pending variant class', () => {
    render(<Badge variant="pending">Pendiente</Badge>)
    expect(screen.getByText('Pendiente').className).toContain('badge-pending')
  })

  it('defaults to default variant', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default').className).toContain('bg-gray-100')
  })

  it('applies all variants without error', () => {
    const variants = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'default'] as const
    for (const v of variants) {
      const { unmount } = render(<Badge variant={v}>{v}</Badge>)
      expect(screen.getByText(v)).toBeInTheDocument()
      unmount()
    }
  })

  it('merges className', () => {
    render(<Badge className="extra">X</Badge>)
    expect(screen.getByText('X').className).toContain('extra')
  })
})

describe('statusToBadge', () => {
  it('maps PENDING to pending', () => {
    expect(statusToBadge('PENDING')).toBe('pending')
  })
  it('maps CONFIRMED to confirmed', () => {
    expect(statusToBadge('CONFIRMED')).toBe('confirmed')
  })
  it('maps COMPLETED to completed', () => {
    expect(statusToBadge('COMPLETED')).toBe('completed')
  })
  it('maps CANCELLED to cancelled', () => {
    expect(statusToBadge('CANCELLED')).toBe('cancelled')
  })
  it('maps NO_SHOW to no_show', () => {
    expect(statusToBadge('NO_SHOW')).toBe('no_show')
  })
  it('returns default for unknown status', () => {
    expect(statusToBadge('UNKNOWN')).toBe('default')
  })
})

describe('STATUS_LABEL', () => {
  it('has labels for all statuses', () => {
    expect(STATUS_LABEL.PENDING).toBe('Pendiente')
    expect(STATUS_LABEL.CONFIRMED).toBe('Confirmada')
    expect(STATUS_LABEL.COMPLETED).toBe('Completada')
    expect(STATUS_LABEL.CANCELLED).toBe('Cancelada')
    expect(STATUS_LABEL.NO_SHOW).toBe('No asistió')
  })
})
