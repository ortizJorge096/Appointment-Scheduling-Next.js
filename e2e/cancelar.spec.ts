// e2e/cancelar.spec.ts
// Public token-based cancellation. Creates the appointment via API (day ≥3 ahead → cancelable).
import { test, expect } from '@playwright/test'
import { createFutureAppointment } from './helpers'

test.describe('Cancelación con token', () => {
  test('cancela una cita con token válido', async ({ page, request }) => {
    const { id, token } = await createFutureAppointment(request)

    await page.goto(`/cancelar?id=${id}&token=${token}`)
    await expect(page.getByRole('heading', { name: /Cancelar tu cita/i })).toBeVisible()
    await page.getByRole('button', { name: /Sí, cancelar cita/i }).click()
    await expect(page.getByText(/Cita cancelada/i)).toBeVisible({ timeout: 15_000 })
  })

  test('rechaza un token inválido', async ({ page, request }) => {
    const { id } = await createFutureAppointment(request)

    await page.goto(`/cancelar?id=${id}&token=token-invalido`)
    await page.getByRole('button', { name: /Sí, cancelar cita/i }).click()
    await expect(page.getByText(/inválido/i)).toBeVisible({ timeout: 15_000 })
  })
})
