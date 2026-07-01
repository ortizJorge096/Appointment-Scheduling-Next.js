// src/app/api/audit/route.ts
// GET /api/audit  → list audit log entries (admin)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'auditoria:ver')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const entity    = searchParams.get('entity')
  const action    = searchParams.get('action')
  const actorType = searchParams.get('actorType')
  const search    = searchParams.get('search')?.trim()
  const dateFrom  = searchParams.get('dateFrom')
  const dateTo    = searchParams.get('dateTo')
  const page      = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit     = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

  const where: Record<string, unknown> = {}
  if (entity) where.entity = entity
  if (action) where.action = action
  if (actorType) where.actorType = actorType
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo   ? { lte: new Date(`${dateTo}T23:59:59`)   } : {}),
    }
  }
  // Search by client/appointment name or the affected id — against the readable
  // description (which embeds the client name), the actor email and the entityId.
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { userEmail:   { contains: search, mode: 'insensitive' } },
      { entityId:    { contains: search, mode: 'insensitive' } },
    ]
  }

  let logs, total
  try {
    ;[logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error listando audit logs:', err)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    },
  })
}
