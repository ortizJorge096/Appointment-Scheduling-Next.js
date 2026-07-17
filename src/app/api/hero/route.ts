// src/app/api/hero/route.ts
// GET  → list active hero images (public) — used by the landing hero carousel
// POST → registers in the DB an image already uploaded to S3 (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { heroCreateSchema } from '@/lib/validations'
import { getPublicUrl } from '@/lib/s3'
import { audit, getClientIp } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  // Active-only for the public landing; listing hidden ones is admin-only (opt-in).
  const includeInactive =
    !!session && new URL(request.url).searchParams.get('includeInactive') === 'true'

  const images = await prisma.heroImage.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })

  const withUrl = images.map((i) => ({
    id: i.id,
    order: i.order,
    isActive: i.isActive,
    focalPoint: i.focalPoint,
    url: getPublicUrl(i.s3Key),
    s3Key: session ? i.s3Key : undefined, // only admin needs the key
  }))

  return NextResponse.json({ success: true, data: withUrl })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'galeria:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = heroCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { s3Key, focalPoint } = parsed.data
  const last = await prisma.heroImage.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
  const nextOrder = (last?.order ?? 0) + 1

  const created = await prisma.heroImage.create({
    data: { s3Key, focalPoint: focalPoint ?? 'center center', order: nextOrder, isActive: true },
  })

  // The landing is ISR — refresh it so the new banner shows without waiting an hour.
  revalidatePath('/')
  await audit({
    action:      'CREATE',
    entity:      'GALLERY', // hero is gallery-adjacent content; reuse the entity to avoid an enum change
    entityId:    created.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: 'Imagen agregada al hero',
  })

  return NextResponse.json(
    { success: true, data: { ...created, url: getPublicUrl(created.s3Key) } },
    { status: 201 }
  )
}
