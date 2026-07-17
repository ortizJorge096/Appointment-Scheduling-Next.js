// src/lib/hero.ts
// Server-only (imports prisma + fs) — consumed by Hero.tsx, a Server Component.
// Hero carousel images come from the DB (admin-managed, S3-backed) so they can
// change WITHOUT a rebuild. If none are set — or the DB is unreachable, e.g. a
// build-time prerender — it falls back to files bundled in /public/hero/, the
// legacy source that DOES need a rebuild to change. Ordered by `order`, newest
// first; each slide carries its focal point for the hard banner crop.

import { readdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { getPublicUrl } from '@/lib/s3'

export interface HeroSlide {
  src: string
  focalPoint: string
}

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i

export async function listHeroImages(): Promise<HeroSlide[]> {
  // 1. Admin-managed hero images (DB + S3) — the primary source, no rebuild needed.
  try {
    const rows = await prisma.heroImage.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { s3Key: true, focalPoint: true },
    })
    if (rows.length > 0) {
      return rows.map((r) => ({ src: getPublicUrl(r.s3Key), focalPoint: r.focalPoint }))
    }
  } catch {
    // DB unreachable (build-time prerender without a database) → fall back to /public.
  }

  // 2. Fallback: files bundled in /public/hero/ (legacy; changing them needs a rebuild).
  try {
    const dir = path.join(process.cwd(), 'public', 'hero')
    const files = await readdir(dir)
    return files
      .filter((f) => IMAGE_RE.test(f) && !f.startsWith('.'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((f) => ({ src: `/hero/${f}`, focalPoint: 'center center' }))
  } catch {
    // No folder / unreadable → caller falls back to the single hero image.
    return []
  }
}
