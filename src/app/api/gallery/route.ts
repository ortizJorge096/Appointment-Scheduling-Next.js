// src/app/api/gallery/route.ts
// GET  → lista imágenes activas (público) — usado por la home
// POST → registra en BD una imagen ya subida a S3 (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { galleryCreateSchema } from '@/lib/validations'
import { getPublicUrl } from '@/lib/s3'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  // Si hay sesión admin → ver todas; si es público → solo activas
  const session = await getServerSession(authOptions)

  const images = await prisma.galleryImage.findMany({
    where: session ? {} : { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })

  const withUrl = images.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    category: i.category,
    width: i.width,
    height: i.height,
    order: i.order,
    isActive: i.isActive,
    url: getPublicUrl(i.s3Key),
    s3Key: session ? i.s3Key : undefined, // solo el admin necesita la key
  }))

  return NextResponse.json({ success: true, data: withUrl })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
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

  const { s3Key, title, category, width, height } = parsed.data

  // El order por defecto es el siguiente al máximo existente
  const last = await prisma.galleryImage.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const nextOrder = (last?.order ?? 0) + 1

  const created = await prisma.galleryImage.create({
    data: {
      s3Key,
      title: title ?? null,
      category: category ?? null,
      width: width ?? null,
      height: height ?? null,
      order: nextOrder,
      isActive: true,
    },
  })

  return NextResponse.json(
    {
      success: true,
      data: { ...created, url: getPublicUrl(created.s3Key) },
    },
    { status: 201 }
  )
}
