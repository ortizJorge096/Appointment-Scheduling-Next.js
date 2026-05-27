// src/app/api/schedules/route.ts
// GET  /api/schedules  → listar horarios
// POST /api/schedules  → crear/actualizar horario (upsert por día)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scheduleSchema } from '@/lib/validations'

export async function GET() {
  const schedules = await prisma.schedule.findMany({ orderBy: { dayOfWeek: 'asc' } })
  return NextResponse.json({ success: true, data: schedules })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body   = await request.json()
  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const schedule = await prisma.schedule.upsert({
    where:  { dayOfWeek: parsed.data.dayOfWeek as any },
    update: parsed.data,
    create: parsed.data,
  })

  return NextResponse.json({ success: true, data: schedule })
}
