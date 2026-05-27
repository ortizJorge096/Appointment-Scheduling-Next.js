// scripts/send-reminders.ts
// Cron job — envía recordatorios 24h antes de cada cita confirmada
//
// Configurar en EC2 con crontab:
//   0 8 * * * cd /app && npx ts-node scripts/send-reminders.ts >> /var/log/valentinajimenez-reminders.log 2>&1
//
// Esto se ejecuta todos los días a las 8:00 AM y envía recordatorios
// para las citas del día siguiente.

import { PrismaClient } from '@prisma/client'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
export const dynamic = 'force-dynamic'

// Cargar variables de entorno en scripts
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()
const ses = new SESClient({ region: process.env.AWS_REGION! })

async function main() {
  console.log(`\n🔔 [${new Date().toISOString()}] Iniciando envío de recordatorios...`)

  // Calcular rango: mañana desde 00:00 hasta 23:59
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(23, 59, 59, 999)

  // Citas confirmadas de mañana sin recordatorio enviado aún
  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: tomorrow, lte: tomorrowEnd },
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
      const dateFormatted = new Date(appt.date).toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: 'America/Bogota',
      })

      await ses.send(new SendEmailCommand({
        Source: `valentinajimenez <${process.env.SES_FROM_EMAIL}>`,
        Destination: { ToAddresses: [appt.clientEmail] },
        Message: {
          Subject: {
            Data: `Recordatorio: tu cita de ${appt.service.name} es mañana · valentinajimenez`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: `
                <p>Hola ${appt.clientName},</p>
                <p>Tu cita de <strong>${appt.service.name}</strong> es mañana,
                   <strong>${dateFormatted} a las ${appt.startTime}</strong>.</p>
                <p>¡Te esperamos! Recuerda llegar 5 minutos antes.</p>
                <br/>
                <p style="color:#999;font-size:12px;">Valentina Jimenez Beauty Studio</p>
              `,
            },
          },
        },
      }))

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
