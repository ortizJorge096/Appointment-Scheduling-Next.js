// src/app/api/gallery/upload-url/route.ts
// POST → Generates a signed PUT URL so the admin's browser
//        uploads the file directly to S3.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { galleryUploadUrlSchema } from '@/lib/validations'
import { getPresignedUploadUrl, buildGalleryKey } from '@/lib/s3'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

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

  const parsed = galleryUploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { filename, contentType } = parsed.data
  // short random id for the key
  const id = randomBytes(9).toString('base64url')
  const key = buildGalleryKey(id, filename)

  try {
    const presigned = await getPresignedUploadUrl({ key, contentType })
    return NextResponse.json({ success: true, data: presigned })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando URL'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
