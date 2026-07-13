// src/app/api/admin-guards.contract.test.ts
// Contract test: every API route that touches privileged data must go through an
// auth check (getCurrentAdmin / requirePermission / getServerSession). It walks
// every route.ts under src/app/api and fails if one lacks a guard AND isn't on the
// explicit public allowlist — so a NEW admin route that forgets the guard can't
// slip through, and exposing a route publicly stays a deliberate, reviewed act.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const API_DIR = join(process.cwd(), 'src', 'app', 'api')

// Routes that legitimately need NO admin guard (the public surface). Anything not
// listed here MUST reference an auth check.
const PUBLIC_ALLOWLIST = new Set([
  'auth/[...nextauth]/route.ts',       // NextAuth handler itself
  'health/route.ts',                   // liveness / readiness probe
  'availability/route.ts',             // public booking availability
  'availability/next/route.ts',
  'availability/today/route.ts',
  'availability/range/route.ts',
  'appointments/[id]/cancel/route.ts', // public, cancel-token based
  'clients/lookup/route.ts',           // public phone autofill (rate-limited)
])

const AUTH_MARKERS = /getCurrentAdmin|requirePermission|getServerSession/

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === 'route.ts') out.push(full)
  }
  return out
}

const rel = (file: string) => relative(API_DIR, file).split(sep).join('/')

describe('API auth contract', () => {
  const files = routeFiles(API_DIR)

  it('discovers the API route files', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('every non-public route enforces an auth check', () => {
    const unguarded = files
      .map(rel)
      .filter((r) => !PUBLIC_ALLOWLIST.has(r))
      .filter((r) => !AUTH_MARKERS.test(readFileSync(join(API_DIR, r), 'utf8')))
    expect(
      unguarded,
      `Rutas sin guard de auth (agrega getCurrentAdmin/requirePermission, o si es pública añádela a PUBLIC_ALLOWLIST): ${unguarded.join(', ')}`,
    ).toEqual([])
  })

  it('the public allowlist has no stale entries', () => {
    const present = new Set(files.map(rel))
    const stale = [...PUBLIC_ALLOWLIST].filter((p) => !present.has(p))
    expect(stale, `Entradas obsoletas en PUBLIC_ALLOWLIST: ${stale.join(', ')}`).toEqual([])
  })
})
