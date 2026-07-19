// src/app/api/hero/upload-url/route.ts
// POST → signed PUT URL so the admin's browser uploads a hero image directly to S3.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { galleryUploadUrlSchema } from '@/lib/validations'
import { getPresignedUploadUrl, buildHeroKey } from '@/lib/s3'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

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

  // Same input contract as the gallery upload (filename + image content type).
  const parsed = galleryUploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { filename, contentType } = parsed.data
  const id  = randomBytes(9).toString('base64url')
  const key = buildHeroKey(id, filename)

  try {
    const presigned = await getPresignedUploadUrl({ key, contentType })
    return NextResponse.json({ success: true, data: presigned })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando URL'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
