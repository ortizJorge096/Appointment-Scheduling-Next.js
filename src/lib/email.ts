// src/lib/email.ts
// Email delivery with Resend (https://resend.com).
// To toggle off/on: ENABLE_EMAILS=false in .env.local

import { Resend } from 'resend'
import { STUDIO, WHATSAPP_URL, INSTAGRAM_URL } from './config'
import { audit } from './audit'
import { formatPrice } from './utils'
import type { AppointmentWithService } from '../types'

// ─────────────────────────────────────────────────────────────
// Environment variables are read LAZILY (inside the functions)
// so this module works both in Next.js and in (cron) scripts
// where dotenv is loaded before it's used.
// ENABLE_EMAILS=false → skips sending, only logs to the console.
// ─────────────────────────────────────────────────────────────

// Memoized Resend client — created on the first real send.
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const emailsEnabled = () => process.env.ENABLE_EMAILS !== 'false'
// The "from" address must be on a domain verified in Resend. EMAIL_FROM
// overrides; SES_FROM_EMAIL is kept as a fallback for backward compatibility.
const fromEmail     = () => process.env.EMAIL_FROM ?? process.env.SES_FROM_EMAIL ?? STUDIO.email
// Prefer the baked public URL; fall back to NEXTAUTH_URL (a RUNTIME server var,
// so it survives a build that didn't bake NEXT_PUBLIC_APP_URL), then localhost.
// Use `||` (not `??`) so an EMPTY baked value also falls through — otherwise
// email links come out hostless, e.g. "http:///cancelar".
const appUrl        = () => process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

// ─── Helpers ──────────────────────────────────────────────────
// (formatDate/formatPrice produce Spanish, user-facing strings)
function formatDate(date: string | Date, startTime: string): string {
  return `${new Date(date).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota',
  })} a las ${startTime}`
}

// ─── Base template ────────────────────────────────────────────
function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${STUDIO.name}</title>
</head>
<body style="margin:0;padding:0;background:#FAF7EE;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:4px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#1A1209;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:300;letter-spacing:0.04em;">
              ${STUDIO.shortName}
              <em style="color:#B8932A;font-style:italic;"> ${STUDIO.tagline}</em>
            </p>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:40px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #E8DCC4;text-align:center;">
            <p style="margin:0;color:#7A7060;font-size:12px;line-height:1.6;">
              ${STUDIO.name} · ${STUDIO.city}, ${STUDIO.country}<br/>
              <a href="${appUrl()}" style="color:#B8932A;">${appUrl().replace('https://', '')}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()
}

// ─── Confirmation email ───────────────────────────────────────
export async function sendConfirmationEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { clientName, clientEmail, service, services, date, startTime, id, cancelToken, totalDurationMinutes } = appointment
  const cancelUrl = cancelToken
    ? `${appUrl()}/cancelar?id=${id}&token=${cancelToken}`
    : null

  // Multi-service support
  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name
  const serviceDuration = totalDurationMinutes || service.durationMinutes
  const servicePrice = isMultiService ? services!.reduce((sum, s) => sum + s.price, 0) : service.price

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      ¡Tu cita está confirmada!
    </h1>
    <p style="margin:0 0 32px;color:#7A7060;font-size:15px;line-height:1.7;">
      Hola ${clientName}, tu reserva ha sido recibida. Aquí tienes los detalles:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#FAF7EE;padding:24px;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;width:40%;">Servicio${isMultiService ? 's' : ''}</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;font-weight:600;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Fecha y hora</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${formatDate(date, startTime)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Duración</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${serviceDuration} minutos</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Valor</td>
        <td style="padding:8px 0;color:#B8932A;font-size:16px;font-weight:600;border-top:1px solid #E8DCC4;">
          ${formatPrice(servicePrice)}
        </td>
      </tr>
    </table>
    <p style="color:#7A7060;font-size:14px;line-height:1.8;margin:0 0 8px;">
      📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STUDIO.address)}"
            style="color:#1A1209;text-decoration:underline;">${STUDIO.address}</a>
    </p>
    <p style="color:#7A7060;font-size:14px;line-height:1.8;margin:0 0 24px;">
      ¿Dudas? Escríbenos por <a href="${WHATSAPP_URL}" style="color:#B8932A;text-decoration:underline;">WhatsApp</a>.
    </p>
    <p style="color:#7A7060;font-size:14px;line-height:1.8;">
      Si necesitas cancelar, hazlo con al menos <strong>24 horas de anticipación</strong>.
    </p>
    ${cancelUrl ? `
    <p style="margin:8px 0 0;">
      <a href="${cancelUrl}"
         style="display:inline-block;color:#B8932A;font-size:13px;text-decoration:underline;">
        Cancelar mi cita
      </a>
    </p>` : ''}
    <p style="color:#7A7060;font-size:13px;margin-top:16px;">
      Código: <code style="background:#F2EBD9;padding:2px 6px;color:#1A1209;">
        ${id.slice(0, 8).toUpperCase()}
      </code>
    </p>`

  await sendEmail({
    to:      clientEmail,
    subject: `Cita confirmada — ${serviceName} · ${STUDIO.name}`,
    html:    baseTemplate(content),
  })
}

// ─── Rescheduled email ─────────────────────────────────────────
export async function sendRescheduledEmail(
  appointment: AppointmentWithService,
  oldDate: string | Date,
  oldStartTime: string
): Promise<void> {
  const { clientName, clientEmail, service, services, date, startTime, id, cancelToken } = appointment
  const cancelUrl = cancelToken
    ? `${appUrl()}/cancelar?id=${id}&token=${cancelToken}`
    : null

  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      Tu cita fue reprogramada
    </h1>
    <p style="margin:0 0 32px;color:#7A7060;font-size:15px;line-height:1.7;">
      Hola ${clientName}, tu cita de ${serviceName} cambió de horario:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#FAF7EE;padding:24px;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;width:40%;">Antes</td>
        <td style="padding:8px 0;color:#7A7060;font-size:14px;text-decoration:line-through;">
          ${formatDate(oldDate, oldStartTime)}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Ahora</td>
        <td style="padding:8px 0;color:#B8932A;font-size:14px;font-weight:600;border-top:1px solid #E8DCC4;">
          ${formatDate(date, startTime)}
        </td>
      </tr>
    </table>
    <p style="color:#7A7060;font-size:14px;line-height:1.8;">
      Si el nuevo horario no te funciona, puedes cancelar con al menos <strong>24 horas de anticipación</strong>.
    </p>
    ${cancelUrl ? `
    <p style="margin:8px 0 0;">
      <a href="${cancelUrl}"
         style="display:inline-block;color:#B8932A;font-size:13px;text-decoration:underline;">
        Cancelar mi cita
      </a>
    </p>` : ''}`

  await sendEmail({
    to:      clientEmail,
    subject: `Tu cita fue reprogramada — ${serviceName} · ${STUDIO.name}`,
    html:    baseTemplate(content),
  })
}

// ─── Reminder email ───────────────────────────────────────────
export async function sendReminderEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { clientName, clientEmail, service, services, date, startTime, id, cancelToken } = appointment
  const cancelUrl = cancelToken
    ? `${appUrl()}/cancelar?id=${id}&token=${cancelToken}`
    : null

  // Multi-service support
  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      Tu cita es mañana
    </h1>
    <p style="margin:0 0 32px;color:#7A7060;font-size:15px;line-height:1.7;">
      Hola ${clientName}, te recordamos tu cita:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#FAF7EE;padding:24px;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;width:40%;">Servicio${isMultiService ? 's' : ''}</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;font-weight:600;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Cuándo</td>
        <td style="padding:8px 0;color:#B8932A;font-size:14px;font-weight:600;border-top:1px solid #E8DCC4;">
          ${formatDate(date, startTime)}
        </td>
      </tr>
    </table>
    <p style="color:#7A7060;font-size:14px;">
      ¡Te esperamos! Recuerda llegar 5 minutos antes.
    </p>
    ${cancelUrl ? `
    <p style="margin:16px 0 0;">
      <a href="${cancelUrl}"
         style="display:inline-block;color:#B8932A;font-size:13px;text-decoration:underline;">
        ¿No puedes asistir? Cancela aquí
      </a>
    </p>` : ''}`

  await sendEmail({
    to:      clientEmail,
    subject: `Recordatorio: tu cita de ${serviceName} es mañana · ${STUDIO.name}`,
    html:    baseTemplate(content),
  })
}

// ─── Reminder email — 2 hours before ───────────────────────────
// No cancel link here: by this point the 24h cancellation window has
// already closed, so we point them to WhatsApp instead.
export async function sendReminder2hEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { clientName, clientEmail, service, services, date, startTime } = appointment

  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      Tu cita es en 2 horas
    </h1>
    <p style="margin:0 0 32px;color:#7A7060;font-size:15px;line-height:1.7;">
      Hola ${clientName}, ¡te esperamos pronto!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#FAF7EE;padding:24px;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;width:40%;">Servicio${isMultiService ? 's' : ''}</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;font-weight:600;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Cuándo</td>
        <td style="padding:8px 0;color:#B8932A;font-size:14px;font-weight:600;border-top:1px solid #E8DCC4;">
          ${formatDate(date, startTime)}
        </td>
      </tr>
    </table>
    <p style="color:#7A7060;font-size:14px;">
      Recuerda llegar 5 minutos antes. Si tienes algún inconveniente de último momento,
      escríbenos por <a href="${WHATSAPP_URL}" style="color:#B8932A;text-decoration:underline;">WhatsApp</a>.
    </p>`

  await sendEmail({
    to:      clientEmail,
    subject: `Tu cita de ${serviceName} es en 2 horas · ${STUDIO.name}`,
    html:    baseTemplate(content),
  })
}

// ─── Follow-up email — sent the day after a completed appointment ─
export async function sendFollowUpEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { clientName, clientEmail, service, services } = appointment

  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      ¿Cómo te fue?
    </h1>
    <p style="margin:0 0 24px;color:#7A7060;font-size:15px;line-height:1.7;">
      Hola ${clientName}, esperamos que hayas quedado feliz con tu ${serviceName}.
      Nos encantaría saber qué te pareció.
    </p>
    <p style="margin:0 0 32px;">
      <a href="${INSTAGRAM_URL}"
         style="display:inline-block;background:#1A1209;color:#fff;padding:12px 24px;
                font-size:13px;letter-spacing:0.04em;text-decoration:none;">
        Cuéntanos en Instagram
      </a>
    </p>
    <p style="color:#7A7060;font-size:14px;line-height:1.8;">
      ¿Algo que podamos mejorar? Escríbenos por
      <a href="${WHATSAPP_URL}" style="color:#B8932A;text-decoration:underline;">WhatsApp</a>,
      nos ayuda mucho tu opinión.
    </p>`

  await sendEmail({
    to:      clientEmail,
    subject: `¿Cómo te fue con tu ${serviceName}? · ${STUDIO.name}`,
    html:    baseTemplate(content),
  })
}

// ─── Admin notification: new booking (public flow only) ───────
export async function sendAdminNewBookingEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { id, clientName, clientEmail, clientPhone, service, services, date, startTime } = appointment

  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name
  const servicePrice = isMultiService ? services!.reduce((sum, s) => sum + s.price, 0) : service.price
  const detailUrl = `${appUrl()}/admin/citas/${id}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      Nueva cita reservada
    </h1>
    <p style="margin:0 0 32px;color:#7A7060;font-size:15px;line-height:1.7;">
      Un cliente reservó desde la página de agendamiento.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#FAF7EE;padding:24px;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;width:40%;">Cliente</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;font-weight:600;">${clientName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Contacto</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${clientPhone}${clientEmail ? ` · ${clientEmail}` : ' · (sin email)'}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Servicio${isMultiService ? 's' : ''}</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Fecha y hora</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${formatDate(date, startTime)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Valor</td>
        <td style="padding:8px 0;color:#B8932A;font-size:16px;font-weight:600;border-top:1px solid #E8DCC4;">
          ${formatPrice(servicePrice)}
        </td>
      </tr>
    </table>
    <p style="margin:0;">
      <a href="${detailUrl}" style="display:inline-block;color:#B8932A;font-size:13px;text-decoration:underline;">
        Ver cita en el panel
      </a>
    </p>`

  await sendEmail({
    to:      STUDIO.adminEmail,
    subject: `Nueva cita: ${clientName} — ${serviceName}`,
    html:    baseTemplate(content),
  })
}

// ─── Admin notification: client-initiated cancellation ────────
export async function sendAdminCancellationEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { id, clientName, clientPhone, service, services, date, startTime } = appointment

  const isMultiService = services && services.length > 1
  const serviceName = isMultiService ? services!.map((s) => s.service.name).join(' + ') : service.name
  const detailUrl = `${appUrl()}/admin/citas/${id}`

  const content = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:300;color:#1A1209;">
      Cita cancelada por el cliente
    </h1>
    <p style="margin:0 0 32px;color:#7A7060;font-size:15px;line-height:1.7;">
      El cupo quedó libre — puedes reasignarlo.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#FAF7EE;padding:24px;margin-bottom:32px;">
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;width:40%;">Cliente</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;font-weight:600;">${clientName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Contacto</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${clientPhone}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Servicio${isMultiService ? 's' : ''}</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${serviceName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#7A7060;font-size:13px;border-top:1px solid #E8DCC4;">Era el</td>
        <td style="padding:8px 0;color:#1A1209;font-size:14px;border-top:1px solid #E8DCC4;">${formatDate(date, startTime)}</td>
      </tr>
    </table>
    <p style="margin:0;">
      <a href="${detailUrl}" style="display:inline-block;color:#B8932A;font-size:13px;text-decoration:underline;">
        Ver en el panel
      </a>
    </p>`

  await sendEmail({
    to:      STUDIO.adminEmail,
    subject: `Cancelación: ${clientName} — ${serviceName}`,
    html:    baseTemplate(content),
  })
}

// ─── Base function — respects the EMAILS_ENABLED flag ─────────
async function sendEmail({
  to, subject, html,
}: {
  to: string | null | undefined
  subject: string
  html: string
}): Promise<void> {
  // ── NO RECIPIENT ──
  // Clients without an email on file: skip silently (never throw, never send).
  if (!to?.trim()) {
    console.log(`📭 [SIN EMAIL] Omitido (cliente sin correo): "${subject}"`)
    return
  }

  // ── EMAILS OFF ──
  if (!emailsEnabled()) {
    console.log(`📭 [EMAILS DESACTIVADOS] Se habría enviado a ${to}: "${subject}"`)
    return  // returns without sending anything or throwing
  }

  // ── EMAILS ON ──
  try {
    // Resend returns { data, error } instead of throwing on API errors.
    const { error } = await getResend().emails.send({
      from:    `${STUDIO.name} <${fromEmail()}>`,
      to:      [to],
      subject,
      html,
    })
    if (error) throw new Error(error.message)
    console.log(`📧 Email enviado a ${to}: "${subject}"`)
    // Successful sends are high-volume — audited only when explicitly enabled.
    if (process.env.AUDIT_EMAIL_SENT === 'true') {
      audit({
        action: 'EMAIL_SENT', entity: 'EMAIL', entityId: to,
        actorType: 'SYSTEM', description: `Email "${subject}" enviado a ${to}`,
        metadata: { subject, to },
      })
    }
  } catch (error) {
    console.error(`❌ Error enviando email a ${to}:`, error)
    // Email failures are always audited — they're the signal that matters.
    audit({
      action: 'EMAIL_FAILED', entity: 'EMAIL', entityId: to,
      actorType: 'SYSTEM', description: `Falló el email "${subject}" a ${to}`,
      metadata: { subject, to, error: error instanceof Error ? error.message : String(error) },
    })
    throw error
  }
}
