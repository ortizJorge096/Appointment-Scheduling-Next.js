// scripts/send-follow-ups.ts
// Cron job — sends a "¿cómo te fue?" follow-up the day after a completed appointment
//
// Configure in EC2 with crontab (once a day, in the afternoon):
//   0 18 * * * cd /app && npx ts-node scripts/send-follow-ups.ts >> /var/log/vj-follow-ups.log 2>&1
//
// Looks at completed appointments dated 1-2 days ago (a small trailing
// window in case the admin marked something COMPLETED a day late) that
// haven't gotten a follow-up yet.

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { subDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { sendFollowUpEmail } from '../src/lib/email'
import type { AppointmentWithService } from '../src/types'

const prisma = new PrismaClient()
const TZ = 'America/Bogota'

async function main() {
  console.log(`\n💬 [${new Date().toISOString()}] Iniciando envío de seguimientos post-cita...`)

  const nowBogota = toZonedTime(new Date(), TZ)
  const fromStr   = format(subDays(nowBogota, 2), 'yyyy-MM-dd')
  const toStr     = format(subDays(nowBogota, 1), 'yyyy-MM-dd')
  const start = new Date(`${fromStr}T00:00:00`)
  const end   = new Date(`${toStr}T23:59:59.999`)

  console.log(`📅 Buscando citas completadas entre ${fromStr} y ${toStr}`)

  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: start, lte: end },
      status: 'COMPLETED',
      followUpSentAt: null,
    },
    include: {
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
    },
  })

  console.log(`📋 Citas para seguimiento: ${appointments.length}`)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const appt of appointments) {
    if (!appt.clientEmail) { skipped++; continue }
    try {
      await sendFollowUpEmail(appt as unknown as AppointmentWithService)

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { followUpSentAt: new Date() },
      })

      console.log(`  ✅ Seguimiento enviado → ${appt.clientEmail} (${appt.id.slice(0, 8)})`)
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
