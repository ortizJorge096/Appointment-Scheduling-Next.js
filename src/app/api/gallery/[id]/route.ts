// src/app/api/gallery/[id]/route.ts
// PATCH  → actualizar título / categoría / orden / activo (admin)
// DELETE → eliminar imagen (borra el objeto en S3 y el registro en BD)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { galleryUpdateSchema } from '@/lib/validations'
import { deleteObject, getPublicUrl } from '@/lib/s3'

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
    // Si se reemplaza la imagen, borrar el objeto anterior de S3
    if (parsed.data.s3Key) {
      const current = await prisma.galleryImage.findUnique({
        where: { id },
        select: { s3Key: true },
      })
      if (current && current.s3Key !== parsed.data.s3Key) {
        await deleteObject(current.s3Key)
      }
    }

    const updated = await prisma.galleryImage.update({
      where: { id },
      data: parsed.data,
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

  // Primero borra el objeto en S3 (no relanza si falla — el registro debe limpiarse igual)
  await deleteObject(image.s3Key)
  await prisma.galleryImage.delete({ where: { id } })

  return NextResponse.json({ success: true, data: { id, deleted: true } })
}
