// src/app/api/health/route.ts
// Endpoint mínimo para liveness/readiness/startup probes de Kubernetes.
//
// Diseño intencional: NO consultamos la BD aquí.
// El init container (prisma migrate deploy) ya garantiza que el schema
// está aplicado antes de que el app container arranque. Si la BD se cae
// después, las queries reales fallarán con su propio error — no queremos
// que el liveness probe reinicie el pod en cascada y agrave la situación.
// El readiness probe puede sumar un check de BD si lo necesitas.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const startedAt = Date.now()

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    uptime: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
}
