// src/app/layout.tsx
import type { Metadata } from 'next'
import { STUDIO } from '@/lib/config'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: `${STUDIO.name} — Uñas, pestañas y cejas en ${STUDIO.city}`,
    template: `%s · ${STUDIO.name}`,
  },
  description: STUDIO.description,
  keywords:    [...STUDIO.keywords],
  authors:     [{ name: STUDIO.name }],
  metadataBase: new URL(STUDIO.url),
  openGraph: {
    type: 'website', locale: 'es_CO',
    url: STUDIO.url, siteName: STUDIO.name,
    title: `${STUDIO.name} — Uñas, pestañas y cejas en ${STUDIO.city}`,
    description: STUDIO.description,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  )
}
