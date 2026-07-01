// src/app/api/schedules/route.ts
// GET  /api/schedules  → list schedules
// POST /api/schedules  → create/update schedule (upsert by day)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { scheduleSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'
import type { DayOfWeek } from '@prisma/client'

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles', THURSDAY: 'Jueves',
  FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
}

export async function GET(): Promise<NextResponse> {
  const schedules = await prisma.schedule.findMany({ orderBy: { dayOfWeek: 'asc' } })
  return NextResponse.json({ success: true, data: schedules })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  if (!hasPermission(admin.role, 'horarios:editar')) return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const before = await prisma.schedule.findUnique({
    where:  { dayOfWeek: parsed.data.dayOfWeek as DayOfWeek },
    select: { startTime: true, endTime: true, isActive: true },
  })

  const schedule = await prisma.schedule.upsert({
    where:  { dayOfWeek: parsed.data.dayOfWeek as DayOfWeek },
    update: parsed.data,
    create: parsed.data,
  })

  const dayLabel = DAY_LABELS[parsed.data.dayOfWeek] ?? parsed.data.dayOfWeek
  const detail = parsed.data.isActive ? `${parsed.data.startTime}–${parsed.data.endTime}` : 'cerrado'

  await audit({
    action:      'UPDATE',
    entity:      'SCHEDULE',
    entityId:    schedule.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Horario de ${dayLabel} actualizado (${detail})`,
    before:      before ?? undefined,
    after:       { startTime: parsed.data.startTime, endTime: parsed.data.endTime, isActive: parsed.data.isActive },
  })

  return NextResponse.json({ success: true, data: schedule })
}
