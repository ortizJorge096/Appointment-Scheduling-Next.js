// scripts/clear-demo.ts
// Deletes (physically) all appointments marked as demo by fill-day.ts.
//
// Usage:
//   npm run clear-demo                  # deletes ALL appointments with notes = "[demo]"
//   npm run clear-demo -- --date=2026-06-15   # only those on that date

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const DEMO_NOTES = '[demo]'
const prisma = new PrismaClient()

function parseArgs(): Record<string, string> {
  const a: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/)
    if (m) a[m[1]] = m[2]
  }
  return a
}

async function main() {
  const args = parseArgs()
  const where: Record<string, unknown> = { notes: DEMO_NOTES }

  if (args.date) {
    where.date = {
      gte: new Date(`${args.date}T00:00:00`),
      lte: new Date(`${args.date}T23:59:59`),
    }
    console.log(`🧹  Borrando citas demo del ${args.date}...`)
  } else {
    console.log(`🧹  Borrando TODAS las citas demo...`)
  }

  const result = await prisma.appointment.deleteMany({ where })
  console.log(`✅  Eliminadas: ${result.count}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
