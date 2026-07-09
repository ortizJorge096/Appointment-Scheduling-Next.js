// src/app/layout.tsx
import type { Metadata } from 'next'
import { STUDIO } from '@/lib/config'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { StructuredData } from '@/components/StructuredData'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default:  `${STUDIO.name} — Uñas, pestañas y cejas en ${STUDIO.city}`,
    template: `%s · ${STUDIO.name}`,
  },
  description:  STUDIO.description,
  keywords:     [...STUDIO.keywords],
  authors:      [{ name: STUDIO.name }],
  metadataBase: new URL(STUDIO.url),
  alternates: { canonical: '/' },
  openGraph: {
    type:        'website',
    locale:      'es_CO',
    url:         STUDIO.url,
    siteName:    STUDIO.name,
    title:       `${STUDIO.name} — Uñas, pestañas y cejas en ${STUDIO.city}`,
    description: STUDIO.description,
    images:      STUDIO.heroImage ? [{ url: STUDIO.heroImage }] : undefined,
  },
  twitter: {
    card:        'summary_large_image',
    title:       `${STUDIO.name} — Uñas, pestañas y cejas en ${STUDIO.city}`,
    description: STUDIO.description,
    images:      STUDIO.heroImage ? [STUDIO.heroImage] : undefined,
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Preconnect removes DNS/TLS latency before CSS requests the fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* schema.org BeautySalon — helps local search / Google Maps */}
        <StructuredData />
      </head>
      <body className="antialiased">
        {/* GA4 — public pages only; self-disables on /admin and without an ID. */}
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  )
}
