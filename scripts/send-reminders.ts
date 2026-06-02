// scripts/send-reminders.ts
// Cron job — envía recordatorios 24h antes de cada cita confirmada
//
// Configurar en EC2 con crontab:
//   0 8 * * * cd /app && npx ts-node scripts/send-reminders.ts >> /var/log/vj-reminders.log 2>&1
//
// Se ejecuta cada mañana y envía recordatorios para las citas del día siguiente
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

  // "Mañana" en hora de Colombia, no en hora del servidor
  const nowBogota   = toZonedTime(new Date(), TZ)
  const tomorrowStr = format(addDays(nowBogota, 1), 'yyyy-MM-dd')
  const start = new Date(`${tomorrowStr}T00:00:00`)
  const end   = new Date(`${tomorrowStr}T23:59:59.999`)

  console.log(`📅 Buscando citas para ${tomorrowStr} (America/Bogota)`)

  // Citas confirmadas de mañana sin recordatorio enviado aún
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

  for (const appt of appointments) {
    try {
      await sendReminderEmail(appt as unknown as AppointmentWithService)

      // Registrar que el recordatorio fue enviado
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
