// src/app/robots.ts
// robots.txt — index the public site, keep the admin panel, API and
// transactional pages out of search results.
import type { MetadataRoute } from 'next'
import { STUDIO } from '@/lib/config'

export default function robots(): MetadataRoute.Robots {
  const base = STUDIO.url.replace(/\/+$/, '')
  return {
    rules: {
      userAgent: '*',
      allow:     '/',
      disallow:  ['/admin', '/api', '/confirmacion', '/cancelar'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
