// src/app/api/cron/route.ts
// POST /api/cron → scheduled housekeeping, triggered by the k8s CronJob (not a
// user session). Guarded by a shared secret (CRON_SECRET) so only the scheduler
// can run it. Every job is idempotent (tracking columns / deletedAt), so it is
// safe to run repeatedly. Returns a summary of what it did.
//
//   1. Day-before reminders — tomorrow's live appointments (this is the reminder
//      the booking flow always promised but nothing ever sent).
//   2. Follow-ups — yesterday's completed appointments.
//   3. Archive inactive clients — >2 months with no attention and none upcoming.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReminderEmail, sendFollowUpEmail } from '@/lib/email'
import { audit } from '@/lib/audit'
import { STUDIO } from '@/lib/config'
import type { AppointmentWithService } from '@/types'
import { formatInTimeZone } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

// A client with no non-cancelled appointment in this window (and none upcoming)
// is archived. 60 days ≈ "más de 2 meses sin atención".
const INACTIVE_DAYS = 60

const APPT_INCLUDE = {
  service:  { select: { id: true, name: true, price: true, durationMinutes: true } },
  services: { include: { service: { select: { id: true, name: true, price: true, durationMinutes: true } } } },
}

// Full-day [00:00, 24:00) range for a yyyy-MM-dd day, matching how dates are stored.
function dayRange(dayStr: string) {
  return { gte: new Date(`${dayStr}T00:00:00`), lt: new Date(`${dayStr}T23:59:59.999`) }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // The scheduler sends the shared secret; no user session is involved.
  const secret   = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? request.headers.get('x-cron-secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const tz        = STUDIO.timezone
  const today     = formatInTimeZone(new Date(),                    tz, 'yyyy-MM-dd')
  const tomorrow  = formatInTimeZone(new Date(Date.now() + 86_400_000), tz, 'yyyy-MM-dd')
  const yesterday = formatInTimeZone(new Date(Date.now() - 86_400_000), tz, 'yyyy-MM-dd')

  let remindersSent = 0, followUpsSent = 0, clientsArchived = 0

  // ── 1. Day-before reminders ──
  try {
    const due = await prisma.appointment.findMany({
      where: { date: dayRange(tomorrow), status: { in: ['PENDING', 'CONFIRMED'] }, reminderSentAt: null, clientEmail: { not: null } },
      include: APPT_INCLUDE,
    })
    for (const appt of due) {
      try {
        await sendReminderEmail(appt as unknown as AppointmentWithService)
        await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } })
        remindersSent++
      } catch (err) { console.error('Error enviando recordatorio de la cita', appt.id, err) }
    }
  } catch (err) { console.error('Error buscando recordatorios:', err) }

  // ── 2. Follow-ups (day after a completed appointment) ──
  try {
    const done = await prisma.appointment.findMany({
      where: { date: dayRange(yesterday), status: 'COMPLETED', followUpSentAt: null, clientEmail: { not: null } },
      include: APPT_INCLUDE,
    })
    for (const appt of done) {
      try {
        await sendFollowUpEmail(appt as unknown as AppointmentWithService)
        await prisma.appointment.update({ where: { id: appt.id }, data: { followUpSentAt: new Date() } })
        followUpsSent++
      } catch (err) { console.error('Error enviando follow-up de la cita', appt.id, err) }
    }
  } catch (err) { console.error('Error buscando follow-ups:', err) }

  // ── 3. Archive clients with >2 months without attention (and none upcoming) ──
  try {
    const cutoff = new Date(`${today}T00:00:00`)
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS)
    const res = await prisma.client.updateMany({
      where: {
        deletedAt: null,
        createdAt: { lt: cutoff }, // new clients get a grace period before auto-archiving
        // No non-cancelled appointment in the last INACTIVE_DAYS or in the future.
        appointments: { none: { date: { gte: cutoff }, status: { not: 'CANCELLED' } } },
      },
      data: { deletedAt: new Date() },
    })
    clientsArchived = res.count
    if (clientsArchived > 0) {
      await audit({
        action: 'UPDATE', entity: 'CLIENT', entityId: 'inactive-sweep', actorType: 'SYSTEM',
        description: `${clientsArchived} cliente(s) archivado(s) automáticamente por inactividad (>${INACTIVE_DAYS} días sin atención)`,
        metadata: { archived: clientsArchived, inactiveDays: INACTIVE_DAYS },
      })
    }
  } catch (err) { console.error('Error archivando clientes inactivos:', err) }

  return NextResponse.json({ success: true, data: { remindersSent, followUpsSent, clientsArchived } })
}
