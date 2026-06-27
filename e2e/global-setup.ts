// e2e/global-setup.ts
// Prepares the TEST database before the suite: applies migrations and seeds
// deterministic data (admin, services, schedules, professionals). Idempotent —
// safe to run on every E2E run. Uses E2E_DATABASE_URL, never your dev DB.

import { execSync } from 'child_process'
import dotenv from 'dotenv'
import path from 'path'

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e') })

  const url = process.env.E2E_DATABASE_URL
  if (!url) {
    throw new Error(
      'E2E_DATABASE_URL no está definido. Copia .env.e2e.example a .env.e2e y apunta a una base de datos de PRUEBA (no la de dev).'
    )
  }

  const env = { ...process.env, DATABASE_URL: url }
  console.log('[e2e] Aplicando migraciones a la DB de prueba…')
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env })
  console.log('[e2e] Sembrando datos…')
  execSync('npm run db:seed', { stdio: 'inherit', env })
}
