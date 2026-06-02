import { render, screen } from '@testing-library/react'
import { Card, DarkCard, StatCard } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies default padding (md)', () => {
    render(<Card>Content</Card>)
    expect(screen.getByText('Content').className).toContain('p-6')
  })

  it('applies sm padding', () => {
    render(<Card padding="sm">Content</Card>)
    expect(screen.getByText('Content').className).toContain('p-4')
  })
})

describe('DarkCard', () => {
  it('renders children', () => {
    render(<DarkCard>Dark</DarkCard>)
    expect(screen.getByText('Dark')).toBeInTheDocument()
  })
})

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Citas hoy" value={12} />)
    expect(screen.getByText('Citas hoy')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('applies gold accent when accent is true', () => {
    render(<StatCard label="Ingresos" value="$500K" accent />)
    const value = screen.getByText('$500K')
    expect(value.className).toContain('text-gold')
  })
})
