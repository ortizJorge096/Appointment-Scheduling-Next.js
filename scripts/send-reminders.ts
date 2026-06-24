// scripts/send-reminders.ts
// Cron job — sends reminders 24h before each confirmed appointment
//
// Configurar en EC2 con crontab:
//   0 8 * * * cd /app && npx ts-node scripts/send-reminders.ts >> /var/log/vj-reminders.log 2>&1
//
// Runs every morning and sends reminders for the next day's appointments
// (día siguiente calculado en zona horaria America/Bogota).

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { sendReminderEmail } from '../src/lib/email'
import type { AppointmentWithService } from '../src/types'

const prisma = new PrismaClient()
const TZ = 'America/Bogota'

async function main() {
  console.log(`\n🔔 [${new Date().toISOString()}] Iniciando envío de recordatorios...`)

  // "Tomorrow" in Colombia time, not server time
  const nowBogota   = toZonedTime(new Date(), TZ)
  const tomorrowStr = format(addDays(nowBogota, 1), 'yyyy-MM-dd')
  const start = new Date(`${tomorrowStr}T00:00:00`)
  const end   = new Date(`${tomorrowStr}T23:59:59.999`)

  console.log(`📅 Buscando citas para ${tomorrowStr} (America/Bogota)`)

  // Tomorrow's confirmed appointments without reminder sent yet
  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: start, lte: end },
      status: 'CONFIRMED',
      reminderSentAt: null,
    },
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
    },
  })

  console.log(`📋 Citas para recordar: ${appointments.length}`)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const appt of appointments) {
    // Clients without email simply have nothing to remind — skip, don't fail.
    if (!appt.clientEmail) { skipped++; continue }
    try {
      await sendReminderEmail(appt as unknown as AppointmentWithService)

      // Record that the reminder was sent
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      })

      console.log(`  ✅ Recordatorio enviado → ${appt.clientEmail} (${appt.id.slice(0, 8)})`)
      sent++
    } catch (err) {
      console.error(`  ❌ Error con cita ${appt.id}:`, err)
      failed++
    }
  }

  console.log(`\n✅ Enviados: ${sent} | ⏭️  Omitidos (sin email): ${skipped} | ❌ Fallidos: ${failed}`)
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
