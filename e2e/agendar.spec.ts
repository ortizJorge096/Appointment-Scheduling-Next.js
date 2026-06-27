// e2e/agendar.spec.ts
// Flujos públicos de agendamiento. Servicio/profesional/horario son role="radio";
// en VIP los servicios son botones de selección múltiple.
import { test, expect } from '@playwright/test'

async function pickProfessionalAndSlot(page: import('@playwright/test').Page) {
  const primera = page.getByRole('radio', { name: /Primera disponible/i })
  if (await primera.isVisible().catch(() => false)) {
    await primera.click()
    await page.getByRole('button', { name: /Continuar/i }).click()
  }
  const slot = page.getByRole('radio', { name: /^\d{1,2}:\d{2}$/ }).first()
  await expect(slot).toBeVisible({ timeout: 15_000 })
  await slot.click()
  await page.getByRole('button', { name: /Continuar/i }).click()
}

test.describe('Agendamiento público', () => {
  test('reserva una cita de punta a punta', async ({ page }) => {
    await page.goto('/agendar')

    await page.getByRole('button', { name: /Uñas/i }).first().click()
    await page.getByRole('radio', { name: /Manicura tradicional/i }).first().click()
    await page.getByRole('button', { name: /Continuar/i }).click()

    await pickProfessionalAndSlot(page)

    await page.getByPlaceholder('Tu nombre y apellido').fill('Test E2E')
    await page.getByPlaceholder('300 000 0000').fill('3001234567')
    await page.getByRole('button', { name: /Confirmar cita/i }).click()

    await expect(page).toHaveURL(/\/confirmacion/, { timeout: 15_000 })
    await expect(page.getByText(/confirmada/i)).toBeVisible()
  })

  test('VIP: paquete con 2+ servicios', async ({ page }) => {
    await page.goto('/agendar?modo=vip')

    // VIP = selección múltiple → los servicios son role="checkbox". 2+ requeridos.
    await page.getByRole('checkbox', { name: /Manicura tradicional/i }).first().click()
    await page.getByRole('checkbox', { name: /Pedicura tradicional/i }).first().click()
    await page.getByRole('button', { name: /Continuar/i }).click()

    await pickProfessionalAndSlot(page)

    await page.getByPlaceholder('Tu nombre y apellido').fill('Test VIP')
    await page.getByPlaceholder('300 000 0000').fill('3001234567')
    await page.getByRole('button', { name: /Confirmar cita/i }).click()

    await expect(page).toHaveURL(/\/confirmacion/, { timeout: 15_000 })
    await expect(page.getByText(/confirmada/i)).toBeVisible()
  })
})
