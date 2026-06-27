// playwright.config.ts
// E2E against a PRODUCTION build (next build && next start) so there is no
// per-route dev compilation (deterministic, no warm-ups). Uses a dedicated test
// database (E2E_DATABASE_URL) seeded by globalSetup. Reads .env.e2e (gitignored).

import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.e2e') })

const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${PORT}`
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? ''

const serverEnv = {
  ...process.env,
  DATABASE_URL: E2E_DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'e2e-test-secret-not-for-prod',
  NEXTAUTH_URL: baseURL,
  NEXT_PUBLIC_APP_URL: baseURL,
  ENABLE_EMAILS: 'false',
} as Record<string, string>

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',   // migrate + seed the test DB
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 1) Logs in as admin once and saves the session (storageState).
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2) Public flows — anonymous (no stored session).
    {
      name: 'public',
      testIgnore: /admin\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 3) Admin flows — reuse the admin session.
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
    },
  ],
  // The build runs in the `test:e2e` npm script (no time limit there); here we
  // only START the prebuilt app, which is fast.
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: serverEnv,
  },
})
