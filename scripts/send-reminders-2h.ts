// scripts/send-reminders-2h.ts
// Cron job — sends a reminder ~2h before each confirmed appointment
//
// Unlike the 24h reminder (which only needs to run once a day), this one
// needs fine granularity throughout the day. Configure it in EC2 crontab to
// run every 15 minutes:
//   */15 * * * * cd /app && npx ts-node scripts/send-reminders-2h.ts >> /var/log/vj-reminders-2h.log 2>&1
//
// The target window is 1h45m–2h15m from "now" (a 30min window, comfortably
// wider than the 15min cron interval) so no appointment is skipped between
// runs. `reminder2hSentAt` guards against sending it twice.

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { addMinutes, format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { sendReminder2hEmail } from '../src/lib/email'
import type { AppointmentWithService } from '../src/types'

const prisma = new PrismaClient()
const TZ = 'America/Bogota'

async function main() {
  console.log(`\n🔔 [${new Date().toISOString()}] Iniciando envío de recordatorios 2h...`)

  const now = new Date()
  const windowStart = addMinutes(now, 105) // 1h45m
  const windowEnd   = addMinutes(now, 135) // 2h15m

  // Candidates: confirmed appointments on "today" or "tomorrow" (Bogotá time)
  // that haven't gotten the 2h reminder yet. We fetch broadly by date and
  // filter precisely by real datetime below, since date/startTime are
  // stored separately and the target window can cross midnight.
  const nowBogota   = toZonedTime(now, TZ)
  const todayStr    = format(nowBogota, 'yyyy-MM-dd')
  const tomorrowStr = format(addMinutes(nowBogota, 24 * 60), 'yyyy-MM-dd')
  const rangeStart  = new Date(`${todayStr}T00:00:00`)
  const rangeEnd    = new Date(`${tomorrowStr}T23:59:59.999`)

  const candidates = await prisma.appointment.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
      status: 'CONFIRMED',
      reminder2hSentAt: null,
    },
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
    },
  })

  const appointments = candidates.filter((appt) => {
    const dateStr = format(toZonedTime(appt.date, TZ), 'yyyy-MM-dd')
    const startAt = fromZonedTime(`${dateStr}T${appt.startTime}:00`, TZ)
    return startAt >= windowStart && startAt <= windowEnd
  })

  console.log(`📋 Citas para recordar (2h): ${appointments.length}`)

  let sent = 0
  let failed = 0

  for (const appt of appointments) {
    try {
      await sendReminder2hEmail(appt as unknown as AppointmentWithService)

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminder2hSentAt: new Date() },
      })

      console.log(`  ✅ Recordatorio 2h enviado → ${appt.clientEmail} (${appt.id.slice(0, 8)})`)
      sent++
    } catch (err) {
      console.error(`  ❌ Error con cita ${appt.id}:`, err)
      failed++
    }
  }

  console.log(`\n✅ Enviados: ${sent} | ❌ Fallidos: ${failed}`)
  console.log(`🏁 Proceso completado.\n`)
}

main()
  .catch((e) => {
    console.error('Error crítico en cron:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
