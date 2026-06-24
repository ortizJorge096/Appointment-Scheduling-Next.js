import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FAQ from './FAQ'

describe('FAQ', () => {
  it('renders section heading', () => {
    render(<FAQ />)
    expect(screen.getByText(/preguntas/i)).toBeInTheDocument()
  })

  it('renders all questions collapsed by default', () => {
    render(<FAQ />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => expect(btn).toHaveAttribute('aria-expanded', 'false'))
  })

  it('opens an item on click and closes it on second click', async () => {
    render(<FAQ />)
    const firstBtn = screen.getAllByRole('button')[0]
    await userEvent.click(firstBtn)
    expect(firstBtn).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(firstBtn)
    expect(firstBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('only one item is open at a time', async () => {
    render(<FAQ />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    await userEvent.click(buttons[1])
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true')
  })
})
