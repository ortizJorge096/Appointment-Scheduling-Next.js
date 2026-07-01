// src/lib/config.ts
// ─────────────────────────────────────────────────────────────
// CENTRAL BUSINESS CONFIGURATION
// Edit ONLY this file to update the studio's data.
// ─────────────────────────────────────────────────────────────

export const STUDIO = {
  // Identity
  name:      'Valentina Jimenez Beauty Studio',
  shortName: 'Valentina Jimenez',
  tagline:   'Beauty Studio',
  slogan:    'Uñas, pestañas y cejas con acabado profesional.',

  // Location
  city:         'Floridablanca',
  neighborhood: 'La Cumbre',
  state:        'Santander',
  country:      'Colombia',
  address:      'Calle 28 # 7E-14, La Cumbre, Floridablanca, Santander',

  // Contact
  phone:      '+57 300 179 0511',
  whatsapp:   '573001790511',          // no +, no spaces — for wa.me/
  email:      'info@vjbeautystudio.com',
  adminEmail: 'valentinajimenezbeautystudio@gmail.com',
  instagram:  '_valebeautystudio_',
  tiktok:     'valebeautystudio1',

  // Business hours (display text for the UI)
  hours: 'Lun–Vie · 9am–12pm y 2pm–6pm',
  hoursWeekend: 'Fines de semana y festivos',

  // Hero image (editorial split layout). Empty string = elegant gradient
  // placeholder (no broken image). To use a real photo, drop a file in /public
  // and set its path here, e.g. '/hero.jpg' — next/image optimizes it and the
  // component falls back to the gradient if it ever fails to load. Easy to wire
  // to an admin upload (S3) later, same pattern as the gallery.
  heroImage: '/hero.jpg' as string,

  // Business timezone (used for availability calculations and reminders)
  timezone: 'America/Bogota',

  // Granularity of start-time slots, in minutes
  slotGranularityMin: 30,

  // Minimum margin (min) between "now" and the first bookable slot today
  bookingBufferMin: 30,

  // URLs (|| so an empty build-arg falls back instead of becoming '')
  url:    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // SEO
  description:
    'Beauty studio en Floridablanca especializado en uñas, pestañas y cejas. Manicura, semipermanente, acrílico, lifting, volumen, laminado y más. Agenda tu cita en línea.',
  keywords: [
    'uñas', 'manicura', 'pedicura', 'semipermanente', 'acrílico', 'polygel',
    'pestañas', 'lifting', 'volumen', 'cejas', 'laminado de cejas', 'henna',
    'beauty studio', 'Floridablanca', 'Santander',
  ] as string[],
} as const

// ─────────────────────────────────────────────────────────────
// CATEGORY ICONS — predefined set the admin can pick from.
// Categories are now stored in the DB (see prisma `Category`); each one
// holds an `icon` key from this list. The keys map to SVG components in
// src/components/public/ServiceIcons.tsx (ICON_REGISTRY). Keep both in sync.
// ─────────────────────────────────────────────────────────────
export const ICON_KEYS = [
  'manicura', 'pedicura', 'pestanas', 'cejas', 'depilacion', 'corte', 'promo',
] as const

export type IconKey = typeof ICON_KEYS[number]

export const ICON_LABELS: Record<IconKey, string> = {
  manicura:   'Manicura / Uñas',
  pedicura:   'Pedicura',
  pestanas:   'Pestañas',
  cejas:      'Cejas',
  depilacion: 'Depilación',
  corte:      'Corte de cabello',
  promo:      'Promo / Combo',
}

export const DEFAULT_ICON: IconKey = 'promo'

// ─────────────────────────────────────────────────────────────
// WHATSAPP — deep link with a preloaded message.
// Number and default message are configurable via env (fall back to STUDIO so
// nothing breaks if the env vars aren't set). NEXT_PUBLIC_* vars are available
// both client- and server-side. Never hardcode the number elsewhere — use this.
// ─────────────────────────────────────────────────────────────
// `||` (not `??`) so an empty build-arg string falls back instead of breaking.
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || STUDIO.whatsapp
const DEFAULT_WHATSAPP_MESSAGE =
  process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE || '¡Hola! Quiero más información.'

/** Builds a wa.me link with a URL-encoded preloaded message. */
export function getWhatsAppUrl(message?: string): string {
  const text = message ?? DEFAULT_WHATSAPP_MESSAGE
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

// Hero carousel images are auto-discovered from /public/hero/ — see
// src/lib/hero.ts (listHeroImages). No env var or list to maintain.

// Derived helpers
export const WHATSAPP_URL  = getWhatsAppUrl()
export const MAILTO_URL    = `mailto:${STUDIO.email}`
export const INSTAGRAM_URL = `https://www.instagram.com/${STUDIO.instagram}/`
export const TIKTOK_URL    = `https://www.tiktok.com/@${STUDIO.tiktok}`
