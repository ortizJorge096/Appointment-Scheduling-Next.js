// src/app/api/gallery/[id]/route.ts
// PATCH  → update title / category / order / active (admin)
// DELETE → delete image (deletes the S3 object and the DB record)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { galleryUpdateSchema } from '@/lib/validations'
import { deleteObject, getPublicUrl } from '@/lib/s3'
import { audit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = galleryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  try {
    // If replacing the image, delete the previous S3 object
    if (parsed.data.s3Key) {
      const current = await prisma.galleryImage.findUnique({
        where: { id },
        select: { s3Key: true },
      })
      if (current && current.s3Key !== parsed.data.s3Key) {
        await deleteObject(current.s3Key)
      }
    }

    const before = await prisma.galleryImage.findUnique({
      where: { id },
      select: { title: true, description: true, categoryId: true, order: true, isActive: true },
    })

    const updated = await prisma.galleryImage.update({
      where: { id },
      data: parsed.data,
    })

    const verb = parsed.data.isActive === false ? 'ocultada'
               : parsed.data.isActive === true  ? 'mostrada'
               : 'actualizada'

    const session = await getServerSession(authOptions)
    await audit({
      action:      'UPDATE',
      entity:      'GALLERY',
      entityId:    id,
      userEmail:   session?.user?.email ?? undefined,
      ip:          getClientIp(request),
      description: `Imagen ${before?.title ? `"${before.title}" ` : ''}${verb}`,
      before:      before ?? undefined,
      after:       parsed.data,
    })

    return NextResponse.json({
      success: true,
      data: { ...updated, url: getPublicUrl(updated.s3Key) },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Imagen no encontrada' },
      { status: 404 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await context.params

  const image = await prisma.galleryImage.findUnique({ where: { id } })
  if (!image) {
    return NextResponse.json(
      { success: false, error: 'Imagen no encontrada' },
      { status: 404 }
    )
  }

  // First delete the S3 object (does not throw if it fails — the record must be cleaned up anyway)
  await deleteObject(image.s3Key)
  await prisma.galleryImage.delete({ where: { id } })

  const session = await getServerSession(authOptions)
  await audit({
    action:      'DELETE',
    entity:      'GALLERY',
    entityId:    id,
    userEmail:   session?.user?.email ?? undefined,
    ip:          getClientIp(_request),
    description: `Imagen ${image.title ? `"${image.title}" ` : ''}eliminada de la galería`,
  })

  return NextResponse.json({ success: true, data: { id, deleted: true } })
}
