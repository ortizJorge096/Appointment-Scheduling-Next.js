// src/app/api/schedules/route.ts
// GET  /api/schedules  → list schedules
// POST /api/schedules  → create/update schedule (upsert by day)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scheduleSchema } from '@/lib/validations'
import type { DayOfWeek } from '@prisma/client'

export async function GET(): Promise<NextResponse> {
  const schedules = await prisma.schedule.findMany({ orderBy: { dayOfWeek: 'asc' } })
  return NextResponse.json({ success: true, data: schedules })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

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

  const schedule = await prisma.schedule.upsert({
    where:  { dayOfWeek: parsed.data.dayOfWeek as DayOfWeek },
    update: parsed.data,
    create: parsed.data,
  })

  return NextResponse.json({ success: true, data: schedule })
}
