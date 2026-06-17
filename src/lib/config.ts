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
  email:      'valentinajimenezbeautystudio@gmail.com',
  adminEmail: 'valentinajimenezbeautystudio@gmail.com',
  instagram:  '_valebeautystudio_',
  tiktok:     'valebeautystudio1',

  // Business hours (display text for the UI)
  hours: 'Lun–Sáb 9am–6pm',

  // Business timezone (used for availability calculations and reminders)
  timezone: 'America/Bogota',

  // Granularity of start-time slots, in minutes
  slotGranularityMin: 30,

  // Minimum margin (min) between "now" and the first bookable slot today
  bookingBufferMin: 30,

  // URLs
  url:    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

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
// SERVICE CATEGORIES — visible label and display order.
// Keys match the Prisma ServiceCategory enum.
// ─────────────────────────────────────────────────────────────
export const SERVICE_CATEGORIES = {
  MANICURA:       { label: 'Manicura',         order: 1 },
  PEDICURA:       { label: 'Pedicura',         order: 2 },
  CEJAS_PESTANAS: { label: 'Cejas y Pestañas', order: 3 },
  DEPILACION:     { label: 'Depilación',       order: 4 },
  CORTE:          { label: 'Corte de Cabello', order: 5 },
  VIP:            { label: 'VIP',              order: 6 },
} as const

export type ServiceCategoryKey = keyof typeof SERVICE_CATEGORIES

// Ordered list of category keys, for iterating in the UI
export const CATEGORY_ORDER = (Object.keys(SERVICE_CATEGORIES) as ServiceCategoryKey[])
  .sort((a, b) => SERVICE_CATEGORIES[a].order - SERVICE_CATEGORIES[b].order)

export function categoryLabel(key: string): string {
  const cat = SERVICE_CATEGORIES[key as keyof typeof SERVICE_CATEGORIES]
  return cat?.label ?? key
}

// Derived helpers
export const WHATSAPP_URL  = `https://wa.me/${STUDIO.whatsapp}`
export const MAILTO_URL    = `mailto:${STUDIO.email}`
export const INSTAGRAM_URL = `https://www.instagram.com/${STUDIO.instagram}/`
export const TIKTOK_URL    = `https://www.tiktok.com/@${STUDIO.tiktok}`
