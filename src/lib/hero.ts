// src/lib/hero.ts
// Server-only (imports fs) — consumed by Hero.tsx, a Server Component.
// Hero carousel images are auto-discovered from /public/hero/ — the folder IS
// the source of truth. Add/remove a photo there (and deploy, since it's baked
// into the image); no code or env changes needed. Ordered by natural filename
// (1.jpg, 2.jpg, … 10.jpg). Recommended 3–6 photos for performance (every slide
// is loaded), but there is no hard cap — what's in the folder is what shows.

import { readdir } from 'fs/promises'
import path from 'path'

const IMAGE_RE = /\.(jpe?g|png|webp|avif)$/i

export async function listHeroImages(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), 'public', 'hero')
    const files = await readdir(dir)
    return files
      .filter((f) => IMAGE_RE.test(f) && !f.startsWith('.'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((f) => `/hero/${f}`)
  } catch {
    // No folder / unreadable → caller falls back to the single hero image.
    return []
  }
}
