// src/app/api/testimonials/route.ts
// GET  /api/testimonials → public: approved + active; admin: all (non-deleted), with ?status / ?active filters
// POST /api/testimonials → create (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { createTestimonialSchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'
import { initialsFromName } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  const { searchParams } = new URL(request.url)

  // The management view (all statuses, full records, filters) is opt-in and
  // needs a session. Everything else — including the landing while an admin is
  // logged in on the same browser — gets the public-safe set: approved + active
  // only, with a trimmed field selection.
  const manage = !!session && searchParams.get('manage') === 'true'

  if (!manage) {
    const data = await prisma.testimonial.findMany({
      where: { deletedAt: null, isActive: true, status: 'APPROVED' },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, clientName: true, initials: true, type: true, text: true, stars: true, imageUrl: true },
    })
    return NextResponse.json({ success: true, data })
  }

  // Admin: all non-deleted, with optional filters.
  const status = searchParams.get('status')
  const active = searchParams.get('active')

  const where: Record<string, unknown> = { deletedAt: null }
  if (status) where.status = status
  if (active === 'true')  where.isActive = true
  if (active === 'false') where.isActive = false

  const data = await prisma.testimonial.findMany({
    where,
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'testimonios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = createTestimonialSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const clientName = parsed.data.clientName.trim()

  const testimonial = await prisma.testimonial.create({
    data: {
      clientName,
      initials:    initialsFromName(clientName),
      type:        parsed.data.type.trim(),
      text:        parsed.data.text.trim(),
      stars:       parsed.data.stars ?? 5,
      imageUrl:    parsed.data.imageUrl ?? null,
      imageKey:    parsed.data.imageKey ?? null,
      order:       parsed.data.order ?? 0,
      clientEmail: parsed.data.clientEmail ?? null,
      // Admin-created testimonials are approved by default.
      source: 'ADMIN',
      status: 'APPROVED',
    },
  })

  await audit({
    action:      'CREATE',
    entity:      'TESTIMONIAL',
    entityId:    testimonial.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Testimonio de "${testimonial.clientName}" creado`,
  })

  return NextResponse.json({ success: true, data: testimonial }, { status: 201 })
}
