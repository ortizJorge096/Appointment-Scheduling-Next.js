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
  slogan:    'Manicure profesional con productos premium.',

  // Ubicación
  city:      'Floridablanca',
  state:     'Santander',
  country:   'Colombia',
  address:   'Floridablanca, Santander, Colombia',

  // Contacto
  phone:      '+57 318 309 6637',
  whatsapp:   '573183096637',          // sin +, sin espacios — para wa.me/
  email:      'hola@vjbeautystudio.com',
  adminEmail: 'admin@vjbeautystudio.com',
  instagram:  'vjbeautystudio',

  // Horario de atención (texto para mostrar en UI)
  hours: 'Lun–Sáb 9am–6pm',

  // URLs
  url:    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

  // SEO
  description:
    'Beauty Studio especializado en manicure profesional. Gel, acrílico, nail art y más. Agenda tu cita en línea.',
  keywords: ['manicure', 'nail art', 'gel', 'acrílico', 'beauty studio', 'Floridablanca'] as string[],
} as const

// Helpers derivados
export const WHATSAPP_URL = `https://wa.me/${STUDIO.whatsapp}`
export const MAILTO_URL   = `mailto:${STUDIO.email}`
