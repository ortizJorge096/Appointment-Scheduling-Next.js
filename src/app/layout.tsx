// src/app/layout.tsx
import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { STUDIO } from '@/lib/config'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
})

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
    <html lang="es" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
