// src/lib/calendar.ts
// Integración con Google Calendar — crea, actualiza y cancela eventos
// cuando se agenda o cancela una cita en el estudio.
//
// Credenciales: Service Account con acceso al calendario de Valentina.
// GOOGLE_CLIENT_EMAIL  → email de la service account (ConfigMap)
// GOOGLE_PRIVATE_KEY   → clave privada del JSON (SSM SecureString)
// GOOGLE_CALENDAR_ID   → ID del calendario (ConfigMap)

import { google } from 'googleapis'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { STUDIO } from './config'
import type { AppointmentWithService } from '@/types'

// ── Cliente lazy ────────────────────────────────────────────────────────
function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey  = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const calendarId  = process.env.GOOGLE_CALENDAR_ID

  if (!clientEmail || !privateKey || !calendarId) {
    throw new Error('Google Calendar no configurado (faltan env vars)')
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key:   privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  })

  return { calendar: google.calendar({ version: 'v3', auth }), calendarId }
}

const calendarEnabled = () =>
  !!(process.env.GOOGLE_CLIENT_EMAIL &&
     process.env.GOOGLE_PRIVATE_KEY   &&
     process.env.GOOGLE_CALENDAR_ID)

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Construye el timestamp ISO 8601 en la zona horaria del negocio.
 * appointment.date es UTC medianoche del día; startTime/endTime son "HH:MM" en hora Colombia.
 */
function buildEventDateTime(dateUtc: Date | string, time: string) {
  const dateStr = format(toZonedTime(new Date(dateUtc), STUDIO.timezone), 'yyyy-MM-dd')
  return {
    dateTime: `${dateStr}T${time}:00`,
    timeZone: STUDIO.timezone,
  }
}

function buildDescription(appt: AppointmentWithService): string {
  const lines = [
    `📱 ${appt.clientPhone}`,
    `✉️ ${appt.clientEmail}`,
  ]
  if (appt.notes) lines.push(`📝 ${appt.notes}`)
  return lines.join('\n')
}

// ── Crear evento ─────────────────────────────────────────────────────────

export async function createCalendarEvent(
  appointment: AppointmentWithService
): Promise<string | null> {
  if (!calendarEnabled()) {
    console.log('📅 [CALENDAR DESACTIVADO] Sin credenciales configuradas')
    return null
  }

  try {
    const { calendar, calendarId } = getCalendarClient()

    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary:     `${appointment.service.name} — ${appointment.clientName}`,
        description: buildDescription(appointment),
        start:       buildEventDateTime(appointment.date, appointment.startTime),
        end:         buildEventDateTime(appointment.date, appointment.endTime),
        colorId:     '11', // rojo-rosado, visible entre otros eventos
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      },
    })

    const eventId = res.data.id ?? null
    console.log(`📅 Evento de calendario creado: ${eventId}`)
    return eventId
  } catch (err) {
    console.error('❌ Error creando evento en Google Calendar:', err)
    return null
  }
}

// ── Cancelar evento ───────────────────────────────────────────────────────

export async function deleteCalendarEvent(calendarEventId: string): Promise<void> {
  if (!calendarEnabled()) return

  try {
    const { calendar, calendarId } = getCalendarClient()
    await calendar.events.delete({ calendarId, eventId: calendarEventId })
    console.log(`📅 Evento de calendario eliminado: ${calendarEventId}`)
  } catch (err) {
    // Si el evento ya no existe en Google, no es un error crítico
    console.error('❌ Error eliminando evento de Google Calendar:', err)
  }
}
