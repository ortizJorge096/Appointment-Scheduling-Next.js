// src/lib/email.ts
// Email delivery with AWS SES
// To toggle off/on: ENABLE_EMAILS=false in .env.local

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { STUDIO } from './config'
import type { AppointmentWithService } from '../types'

// ─────────────────────────────────────────────────────────────
// Environment variables are read LAZILY (inside the functions)
// so this module works both in Next.js and in (cron) scripts
// where dotenv is loaded before it's used.
// ENABLE_EMAILS=false → skips sending, only logs to the console.
// ─────────────────────────────────────────────────────────────

// Memoized SES client — created on the first real send
let _ses: SESClient | null = null
function getSes(): SESClient {
  if (!_ses) {
    // No explicit `credentials`: the SDK uses the default chain
    // (Instance Profile on EC2, environment variables locally).
    _ses = new SESClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    })
  }
  return _ses
}

const emailsEnabled = () => process.env.ENABLE_EMAILS !== 'false'
const fromEmail     = () => process.env.SES_FROM_EMAIL ?? STUDIO.email
const appUrl        = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── Helpers ──────────────────────────────────────────────────
// (formatDate/formatPrice produce Spanish, user-facing strings)
function formatDate(date: string | Date, startTime: string): string {
  return `${new Date(date).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Bogota',
  })} a las ${startTime}`
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(price)
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

// ─── Reminder email ───────────────────────────────────────────
export async function sendReminderEmail(
  appointment: AppointmentWithService
): Promise<void> {
  const { clientName, clientEmail, service, services, date, startTime } = appointment

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
    </p>`

  await sendEmail({
    to:      clientEmail,
    subject: `Recordatorio: tu cita de ${serviceName} es mañana · ${STUDIO.name}`,
    html:    baseTemplate(content),
  })
}

// ─── Base function — respects the EMAILS_ENABLED flag ─────────
async function sendEmail({
  to, subject, html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  // ── EMAILS OFF ──
  if (!emailsEnabled()) {
    console.log(`📭 [EMAILS DESACTIVADOS] Se habría enviado a ${to}: "${subject}"`)
    return  // returns without sending anything or throwing
  }

  // ── EMAILS ON ──
  const command = new SendEmailCommand({
    Source:      `${STUDIO.name} <${fromEmail()}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject,  Charset: 'UTF-8' },
      Body:    { Html: { Data: html, Charset: 'UTF-8' } },
    },
  })

  try {
    await getSes().send(command)
    console.log(`📧 Email enviado a ${to}: "${subject}"`)
  } catch (error) {
    console.error(`❌ Error enviando email a ${to}:`, error)
    throw error
  }
}
