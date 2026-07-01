// src/app/api/audit/export/route.ts
// GET /api/audit/export → download the audit log as CSV (admin), honoring filters.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { audit, getClientIp, getUserAgent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 10000

// RFC-4180 CSV escaping: wrap in quotes, double internal quotes.
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const entity    = searchParams.get('entity')
  const action    = searchParams.get('action')
  const actorType = searchParams.get('actorType')
  const search    = searchParams.get('search')?.trim()
  const dateFrom  = searchParams.get('dateFrom')
  const dateTo    = searchParams.get('dateTo')

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
  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { userEmail:   { contains: search, mode: 'insensitive' } },
      { entityId:    { contains: search, mode: 'insensitive' } },
    ]
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  })

  const header = ['Fecha', 'Acción', 'Entidad', 'Actor', 'Usuario', 'IP', 'Descripción', 'ID afectado']
  const rows = logs.map((l) => [
    l.createdAt.toISOString(),
    l.action,
    l.entity,
    l.actorType ?? '',
    l.userEmail ?? '',
    l.ip ?? '',
    l.description ?? '',
    l.entityId,
  ].map(csvCell).join(','))

  // Exporting the audit trail is itself a security-relevant event — record who
  // did it, with what filters and how many rows (fire-and-forget; never blocks).
  audit({
    action:    'EXPORT',
    entity:    'AUTH',
    entityId:  'audit_logs',
    actorType: 'ADMIN',
    userEmail: session.user?.email ?? undefined,
    ip:        getClientIp(request),
    userAgent: getUserAgent(request),
    description: `${session.user?.email ?? 'Admin'} exportó el log de auditoría (${logs.length} filas)`,
    metadata:  { rowCount: logs.length, filters: { entity, action, actorType, search, dateFrom, dateTo } },
  })

  // BOM so Excel opens UTF-8 (acentos) correctly.
  const csv = '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n')
  const filename = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
