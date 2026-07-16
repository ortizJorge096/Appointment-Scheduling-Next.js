// src/components/StructuredData.tsx
// JSON-LD structured data (schema.org BeautySalon) so Google can show the studio
// as a local business — name, address, hours, socials — in local search and Maps.
import { STUDIO } from '@/lib/config'

export function StructuredData() {
  const base = STUDIO.url.replace(/\/+$/, '')
  const data = {
    '@context':   'https://schema.org',
    '@type':      'BeautySalon',
    '@id':        `${base}/#business`,
    name:         STUDIO.name,
    description:  STUDIO.description,
    url:          base,
    telephone:    STUDIO.phone,
    email:        STUDIO.email,
    image:        STUDIO.heroImage ? `${base}${STUDIO.heroImage}` : undefined,
    priceRange:   '$$',
    currenciesAccepted: 'COP',
    address: {
      '@type':          'PostalAddress',
      streetAddress:    STUDIO.address,
      addressLocality:  STUDIO.city,
      addressRegion:    STUDIO.state,
      addressCountry:   'CO',
    },
    areaServed:   STUDIO.city,
    sameAs: [
      `https://www.instagram.com/${STUDIO.instagram}/`,
      `https://www.tiktok.com/@${STUDIO.tiktok}`,
    ],
  }
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; no user input is interpolated.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
