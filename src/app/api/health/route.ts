import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const startedAt = Date.now()

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ?readiness — verifica DB (para readiness probe, no liveness)
  if (req.nextUrl.searchParams.has('readiness')) {
    try {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      await prisma.$queryRaw`SELECT 1`
      await prisma.$disconnect()
      return NextResponse.json({ status: 'ok', db: 'reachable', uptime: Math.round((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() })
    } catch {
      return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503 })
    }
  }

  // Liveness probe — light check, no DB (avoid cascading restarts)
  return NextResponse.json({
    status: 'ok',
    uptime: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
}
