// e2e/admin.spec.ts
// Admin flows (the "admin" project reuses the session from auth.setup.ts).
import { test, expect } from '@playwright/test'

test.describe('Admin', () => {
  test('login + acceso al panel de citas', async ({ page }) => {
    await page.goto('/admin/citas')
    // If the session were invalid, the protected layout redirects to /admin/login.
    await expect(page).toHaveURL(/\/admin\/citas/)
    await expect(page.getByRole('heading', { name: 'Citas' })).toBeVisible()
  })

  test('crea una cita pasada manual (queda completada y pagada)', async ({ page }) => {
    await page.goto('/admin/citas')
    await page.getByRole('button', { name: /\+ Cita manual/i }).click()

    // "Cita pasada": on save it becomes COMPLETED/PAID, and the total auto-fills
    // with the service price.
    await page.getByRole('button', { name: 'Cita pasada' }).click()
    await page.getByPlaceholder('Ana García').fill('Cliente Manual E2E')
    await page.getByPlaceholder('3001234567').fill('3001234567')
    await page.locator('form select').selectOption({ index: 1 }) // service (modal's select)

    // Yesterday's date (past appointments require a date before today) + a time.
    const d = new Date(); d.setDate(d.getDate() - 1)
    const ayer = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await page.locator('input[aria-label="Fecha"]').fill(ayer)
    await page.locator('input[aria-label="Hora"]').fill('10:00')

    await page.getByRole('button', { name: /Registrar cita pasada/i }).click()
    await expect(page.getByText(/registrada correctamente/i)).toBeVisible({ timeout: 15_000 })
  })
})
