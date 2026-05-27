// src/app/api/schedules/blocked/route.ts
// GET  → listar fechas bloqueadas
// POST → crear fecha bloqueada

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { blockedDateSchema } from '@/lib/validations'

export async function GET() {
  const blocked = await prisma.blockedDate.findMany({
    where: { date: { gte: new Date() } },
    orderBy: { date: 'asc' },
  })
  return NextResponse.json({ success: true, data: blocked })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body   = await request.json()
  const parsed = blockedDateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const blocked = await prisma.blockedDate.create({
    data: {
      date:   new Date(`${parsed.data.date}T12:00:00`),
      reason: parsed.data.reason ?? null,
    },
  })

  return NextResponse.json({ success: true, data: blocked }, { status: 201 })
}
