// src/app/api/gallery/route.ts
// GET  → list active images (public) — used by the home page
// POST → registers in the DB an image already uploaded to S3 (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { galleryCreateSchema } from '@/lib/validations'
import { getPublicUrl } from '@/lib/s3'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  // Active-only is the safe default for everyone — the public home page must
  // never show hidden images, even when an admin is logged in on the same
  // browser. Listing hidden ones is opt-in (admin gallery) and needs a session.
  const includeInactive =
    !!session && new URL(request.url).searchParams.get('includeInactive') === 'true'

  const images = await prisma.galleryImage.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  })

  const withUrl = images.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    categoryId: i.categoryId,
    category: i.category ? { id: i.category.id, name: i.category.name, slug: i.category.slug } : null,
    width: i.width,
    height: i.height,
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
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = galleryCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { s3Key, title, categoryId, width, height } = parsed.data

  // Default order is the next one after the current maximum
  const last = await prisma.galleryImage.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const nextOrder = (last?.order ?? 0) + 1

  const created = await prisma.galleryImage.create({
    data: {
      s3Key,
      title: title ?? null,
      categoryId: categoryId ?? null,
      width: width ?? null,
      height: height ?? null,
      order: nextOrder,
      isActive: true,
    },
  })

  await audit({
    action:      'CREATE',
    entity:      'GALLERY',
    entityId:    created.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Imagen ${created.title ? `"${created.title}" ` : ''}agregada a la galería`,
  })

  return NextResponse.json(
    {
      success: true,
      data: { ...created, url: getPublicUrl(created.s3Key) },
    },
    { status: 201 }
  )
}
