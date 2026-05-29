// src/lib/config.ts
// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN CENTRAL DEL NEGOCIO
// Edita SOLO este archivo para actualizar datos del estudio.
// ─────────────────────────────────────────────────────────────

export const STUDIO = {
  // Identidad
  name:      'Valentina Jimenez Beauty Studio',
  shortName: 'Valentina Jimenez',
  tagline:   'Beauty Studio',
  slogan:    'Uñas, pestañas y cejas con acabado profesional.',

  // Ubicación
  city:         'Floridablanca',
  neighborhood: 'La Cumbre',
  state:        'Santander',
  country:      'Colombia',
  address:      'La Cumbre, Floridablanca, Santander',

  // Contacto
  phone:      '+57 300 179 0511',
  whatsapp:   '573001790511',          // sin +, sin espacios — para wa.me/
  email:      'hola@vjbeautystudio.com',
  adminEmail: 'admin@vjbeautystudio.com',
  instagram:  '_valebeautystudio_',

  // Horario de atención (texto para mostrar en UI)
  hours: 'Lun–Sáb 9am–6pm',

  // Zona horaria del negocio (para cálculos de disponibilidad y recordatorios)
  timezone: 'America/Bogota',

  // Cada cuántos minutos se ofrece un horario de inicio (granularidad de slots)
  slotGranularityMin: 30,

  // Margen mínimo (min) entre "ahora" y el primer horario reservable hoy
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
// CATEGORÍAS DE SERVICIOS — etiqueta visible y orden de aparición
// Las claves coinciden con el enum ServiceCategory de Prisma.
// ─────────────────────────────────────────────────────────────
export const SERVICE_CATEGORIES = {
  UNAS:     { label: 'Uñas',     order: 1 },
  PESTANAS: { label: 'Pestañas', order: 2 },
  CEJAS:    { label: 'Cejas',    order: 3 },
  PROMOS:   { label: 'Promos',   order: 4 },
} as const

export type ServiceCategoryKey = keyof typeof SERVICE_CATEGORIES

// Lista ordenada de claves de categoría, para iterar en la UI
export const CATEGORY_ORDER = (Object.keys(SERVICE_CATEGORIES) as ServiceCategoryKey[])
  .sort((a, b) => SERVICE_CATEGORIES[a].order - SERVICE_CATEGORIES[b].order)

export function categoryLabel(key: string): string {
  return (SERVICE_CATEGORIES as Record<string, { label: string }>)[key]?.label ?? key
}

// Helpers derivados
export const WHATSAPP_URL = `https://wa.me/${STUDIO.whatsapp}`
export const MAILTO_URL   = `mailto:${STUDIO.email}`
