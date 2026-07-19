// src/app/api/hero/[id]/route.ts
// PATCH  → update order / active / focalPoint, or replace the image (admin)
// DELETE → delete the hero image (S3 object + DB record)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin, type CurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { heroUpdateSchema } from '@/lib/validations'
import { deleteObject, getPublicUrl } from '@/lib/s3'
import { audit, getClientIp } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

async function requireHeroEditor(): Promise<
  { admin: CurrentAdmin; error?: undefined } | { admin?: undefined; error: NextResponse }
> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return { error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) }
  }
  if (!hasPermission(admin.role, 'galeria:editar')) {
    return { error: NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 }) }
  }
  return { admin }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireHeroEditor()
  if (guard.error) return guard.error

  const { id } = await context.params

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 }) }

  const parsed = heroUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  try {
    // Replacing the image → delete the previous S3 object first.
    if (parsed.data.s3Key) {
      const current = await prisma.heroImage.findUnique({ where: { id }, select: { s3Key: true } })
      if (current && current.s3Key !== parsed.data.s3Key) {
        await deleteObject(current.s3Key)
      }
    }

    const updated = await prisma.heroImage.update({ where: { id }, data: parsed.data })

    revalidatePath('/')
    const verb = parsed.data.isActive === false ? 'ocultada'
               : parsed.data.isActive === true  ? 'mostrada'
               : 'actualizada'
    await audit({
      action:      'UPDATE',
      entity:      'GALLERY',
      entityId:    id,
      userEmail:   guard.admin.email,
      ip:          getClientIp(request),
      description: `Imagen del hero ${verb}`,
      after:       parsed.data,
    })

    return NextResponse.json({ success: true, data: { ...updated, url: getPublicUrl(updated.s3Key) } })
  } catch {
    return NextResponse.json({ success: false, error: 'Imagen no encontrada' }, { status: 404 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireHeroEditor()
  if (guard.error) return guard.error

  const { id } = await context.params

  const image = await prisma.heroImage.findUnique({ where: { id } })
  if (!image) {
    return NextResponse.json({ success: false, error: 'Imagen no encontrada' }, { status: 404 })
  }

  // Delete the S3 object first (never throws — the record must be cleaned up anyway).
  await deleteObject(image.s3Key)
  await prisma.heroImage.delete({ where: { id } })

  revalidatePath('/')
  await audit({
    action:      'DELETE',
    entity:      'GALLERY',
    entityId:    id,
    userEmail:   guard.admin.email,
    ip:          getClientIp(_request),
    description: 'Imagen eliminada del hero',
  })

  return NextResponse.json({ success: true, data: { id, deleted: true } })
}
