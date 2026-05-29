// scripts/fill-day.ts
// Llena la agenda de un día con citas demo, una a una con un delay
// configurable, para ver cómo reacciona el calendario en vivo.
//
// Uso:
//   npm run fill-day                                     # mañana, primer servicio 45-60 min, delay 2.5s
//   npm run fill-day -- --date=2026-06-15                # día específico
//   npm run fill-day -- --service=lifting                # filtra por nombre (contiene)
//   npm run fill-day -- --delay=1000                     # acelera (ms entre inserts)
//   npm run fill-day -- --date=2026-06-15 --service=manicura --delay=500
//
// Las citas creadas tienen `notes = "[demo]"` para poder limpiarlas con clear-demo.

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, DayOfWeek } from '@prisma/client'
import { addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TZ = 'America/Bogota'
const DEMO_NOTES = '[demo]'

const prisma = new PrismaClient()

const DAYS: DayOfWeek[] = [
  DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
]

function parseArgs(): Record<string, string> {
  const a: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/)
    if (m) a[m[1]] = m[2]
  }
  return a
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function weekdayFromDateStr(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DAYS[new Date(y, m - 1, d).getDay()]
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const args = parseArgs()

  // Defaults
  const defaultDate = format(addDays(toZonedTime(new Date(), TZ), 1), 'yyyy-MM-dd')
  const date        = args.date || defaultDate
  const query       = args.service || ''
  const delayMs     = Number.isFinite(parseInt(args.delay)) ? parseInt(args.delay) : 2500

  console.log(`\n📅  Llenando agenda para ${date}`)
  console.log(`⏱   Delay entre inserts: ${delayMs} ms\n`)

  // 1. Servicio: filtra por nombre si --service=…, si no toma uno de 45-60 min
  const service = query
    ? await prisma.service.findFirst({
        where: {
          isActive: true,
          name: { contains: query, mode: 'insensitive' },
        },
      })
    : await prisma.service.findFirst({
        where: { isActive: true, durationMinutes: { gte: 45, lte: 60 } },
        orderBy: { order: 'asc' },
      })

  if (!service) {
    console.error(`❌ No encontré un servicio activo${query ? ` con "${query}"` : ''}.`)
    process.exit(1)
  }
  console.log(`💅  Servicio: ${service.name} · ${service.durationMinutes} min · $${service.price.toLocaleString('es-CO')}`)

  // 2. Horario del día
  const dow = weekdayFromDateStr(date)
  const schedule = await prisma.schedule.findUnique({ where: { dayOfWeek: dow } })
  if (!schedule || !schedule.isActive) {
    console.error(`❌ El día (${dow}) no tiene atención. Cambia la fecha o activa el horario.`)
    process.exit(1)
  }
  console.log(`🕘  Horario: ${schedule.startTime} – ${schedule.endTime}\n`)

  // 3. Citas existentes en ese día (para saltar los huecos ya tomados)
  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd   = new Date(`${date}T23:59:59`)
  const existing = await prisma.appointment.findMany({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { startTime: true, endTime: true },
  })
  const taken = existing.map((e) => ({
    s: timeToMin(e.startTime),
    e: timeToMin(e.endTime),
  }))

  if (existing.length > 0) {
    console.log(`ℹ️   Ya hay ${existing.length} cita(s) en este día, los saltamos.\n`)
  }

  // 4. Insertar slot por slot, back-to-back
  const open  = timeToMin(schedule.startTime)
  const close = timeToMin(schedule.endTime)
  const dur   = service.durationMinutes

  let inserted = 0
  let skipped  = 0
  let cursor   = open

  while (cursor + dur <= close) {
    const s = cursor
    const e = cursor + dur
    const overlap = taken.some((t) => s < t.e && e > t.s)

    if (overlap) {
      skipped++
      cursor += dur
      continue
    }

    const startStr = minToTime(s)
    const endStr   = minToTime(e)
    const n = inserted + 1
    const stamp = Date.now().toString(36)

    try {
      await prisma.appointment.create({
        data: {
          clientName:  `Demo ${n}`,
          clientEmail: `demo-${n}-${stamp}@example.com`,
          clientPhone: `3000000${String(n).padStart(3, '0')}`,
          serviceId:   service.id,
          date:        dayStart,
          startTime:   startStr,
          endTime:     endStr,
          status:      'CONFIRMED',
          notes:       DEMO_NOTES,
        },
      })
      taken.push({ s, e })
      inserted++
      const left = Math.floor((close - cursor - dur) / dur)
      console.log(`  ✅  ${startStr} – ${endStr}   cita #${n}   (faltan ${left})`)
    } catch (err) {
      console.error(`  ❌  ${startStr}: ${err instanceof Error ? err.message : err}`)
    }

    cursor += dur
    if (cursor + dur <= close) await sleep(delayMs)
  }

  console.log(
    `\n🎉  Listo. Insertadas: ${inserted} · Saltadas (ya ocupadas): ${skipped}`
  )
  console.log(`👀  Revisa el calendario en /agendar — el día debe quedar gris (sin cupo).`)
  console.log(`🧹  Para limpiar: npm run clear-demo\n`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
