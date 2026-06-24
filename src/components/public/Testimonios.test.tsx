import { render, screen } from '@testing-library/react'
import Testimonios from './Testimonios'

describe('Testimonios', () => {
  it('renderiza el título de la sección', () => {
    render(<Testimonios />)
    expect(screen.getByText('Testimonios')).toBeInTheDocument()
  })

  it('renderiza las 3 tarjetas placeholder con iniciales (sin nombres inventados)', () => {
    render(<Testimonios />)
    expect(screen.getByText('C.M.')).toBeInTheDocument()
    expect(screen.getByText('D.R.')).toBeInTheDocument()
    expect(screen.getByText('V.P.')).toBeInTheDocument()
  })
})
