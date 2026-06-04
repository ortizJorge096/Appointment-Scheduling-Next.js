import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const startedAt = Date.now()

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ?readiness — verifica DB usando el singleton (no crea nuevas conexiones)
  if (req.nextUrl.searchParams.has('readiness')) {
    try {
      await prisma.$queryRaw`SELECT 1`
      return NextResponse.json({
        status: 'ok',
        db: 'reachable',
        uptime: Math.round((Date.now() - startedAt) / 1000),
        timestamp: new Date().toISOString(),
      })
    } catch {
      return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503 })
    }
  }

  // Liveness probe — sin BD para evitar reinicios en cascada
  return NextResponse.json({
    status: 'ok',
    uptime: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
}
