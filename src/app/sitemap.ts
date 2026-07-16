// src/app/sitemap.ts
// Sitemap for search engines. Only public, indexable pages — transactional
// routes (/confirmacion, /cancelar) and /admin are intentionally excluded.
import type { MetadataRoute } from 'next'
import { STUDIO } from '@/lib/config'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = STUDIO.url.replace(/\/+$/, '')
  const now  = new Date()
  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/agendar`, lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/galeria`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]
}
