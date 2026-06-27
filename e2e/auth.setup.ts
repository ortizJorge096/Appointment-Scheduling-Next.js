// e2e/auth.setup.ts
// Logs in as the seeded admin once and saves the session for the admin project.
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth', 'admin.json')

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByPlaceholder('admin@vjbeautystudio.com').fill('admin@vjbeautystudio.com')
  await page.locator('input[type="password"]').fill('Admin123!')
  await page.getByRole('button', { name: /Ingresar/i }).click()

  // On success the app pushes to /admin (the protected layout would bounce back
  // to /admin/login if auth failed).
  await page.waitForURL((url) => url.pathname === '/admin', { timeout: 15_000 })
  await expect(page).not.toHaveURL(/\/admin\/login/)

  await page.context().storageState({ path: authFile })
})
