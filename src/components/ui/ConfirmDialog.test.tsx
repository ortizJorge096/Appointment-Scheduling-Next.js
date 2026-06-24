import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { ConfirmDialogProvider, useConfirm } from './ConfirmDialog'

function Harness({ danger = false }: { danger?: boolean }) {
  const confirm = useConfirm()
  const [result, setResult] = useState<string>('idle')

  async function ask() {
    const ok = await confirm({ message: '¿Eliminar este registro?', danger, confirmLabel: 'Sí, eliminar' })
    setResult(ok ? 'confirmed' : 'cancelled')
  }

  return (
    <div>
      <button onClick={ask}>Disparar</button>
      <p>Resultado: {result}</p>
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('no muestra el modal hasta que se invoca confirm()', () => {
    render(<ConfirmDialogProvider><Harness /></ConfirmDialogProvider>)
    expect(screen.queryByText('¿Eliminar este registro?')).not.toBeInTheDocument()
  })

  it('muestra el mensaje y resuelve true al confirmar', async () => {
    render(<ConfirmDialogProvider><Harness /></ConfirmDialogProvider>)
    fireEvent.click(screen.getByText('Disparar'))

    expect(await screen.findByText('¿Eliminar este registro?')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Sí, eliminar'))

    await waitFor(() => expect(screen.getByText('Resultado: confirmed')).toBeInTheDocument())
    expect(screen.queryByText('¿Eliminar este registro?')).not.toBeInTheDocument()
  })

  it('resuelve false al cancelar', async () => {
    render(<ConfirmDialogProvider><Harness /></ConfirmDialogProvider>)
    fireEvent.click(screen.getByText('Disparar'))

    await screen.findByText('¿Eliminar este registro?')
    fireEvent.click(screen.getByText('Cancelar'))

    await waitFor(() => expect(screen.getByText('Resultado: cancelled')).toBeInTheDocument())
  })

  it('resuelve false al hacer clic fuera del modal (overlay)', async () => {
    render(<ConfirmDialogProvider><Harness /></ConfirmDialogProvider>)
    fireEvent.click(screen.getByText('Disparar'))

    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(dialog.parentElement!) // overlay, not the dialog box itself

    await waitFor(() => expect(screen.getByText('Resultado: cancelled')).toBeInTheDocument())
  })

  it('usa el estilo destructivo cuando danger=true', async () => {
    render(<ConfirmDialogProvider><Harness danger /></ConfirmDialogProvider>)
    fireEvent.click(screen.getByText('Disparar'))

    const confirmBtn = await screen.findByText('Sí, eliminar')
    expect(confirmBtn.className).toContain('text-red-500')
  })

  it('useConfirm() degrada a window.confirm cuando no hay provider', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Harness />) // sin <ConfirmDialogProvider>
    fireEvent.click(screen.getByText('Disparar'))

    await waitFor(() => expect(screen.getByText('Resultado: confirmed')).toBeInTheDocument())
    expect(confirmSpy).toHaveBeenCalledWith('¿Eliminar este registro?')
    confirmSpy.mockRestore()
  })
})
