// src/lib/s3.ts
// Helpers de S3. El cliente usa el "default credential provider chain" del SDK:
//   1. Variables de entorno (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
//   2. ~/.aws/credentials (perfil)
//   3. Instance Profile de EC2 (en producción)
//   4. Role de ECS / Lambda / etc.
//
// En desarrollo local: `aws configure` o exporta las variables en .env.local.
// En producción (EC2 con Instance Profile): NO necesitas claves en .env.

import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ── Constantes ────────────────────────────────────────────────
const PRESIGN_EXPIRES_SEC = 60 * 5         // 5 minutos para subir
export const GALLERY_PREFIX = 'gallery/'   // todas las imágenes de galería van bajo este prefijo
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024  // 5 MB

// ── Cliente lazy (igual patrón que lib/email.ts) ──────────────
let _client: S3Client | null = null
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      // Sin `credentials`: el SDK usa la cadena por defecto.
    })
  }
  return _client
}

function getBucket(): string {
  const b = process.env.AWS_S3_BUCKET
  if (!b) throw new Error('AWS_S3_BUCKET no está configurado')
  return b
}

function getRegion(): string {
  return process.env.AWS_REGION ?? 'us-east-1'
}

/**
 * URL pública de un objeto. Si configuras `AWS_S3_PUBLIC_BASE_URL`
 * (p. ej. una distribución de CloudFront), se usa esa base.
 */
export function getPublicUrl(key: string): string {
  const customBase = process.env.AWS_S3_PUBLIC_BASE_URL
  if (customBase) {
    return `${customBase.replace(/\/$/, '')}/${key}`
  }
  const bucket = getBucket()
  const region = getRegion()
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

/**
 * Genera una URL PUT firmada para que el navegador del admin
 * suba un archivo directamente a S3.
 */
export async function getPresignedUploadUrl(args: {
  key: string
  contentType: string
}): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: args.key,
    ContentType: args.contentType,
    // Para que el objeto se pueda leer de forma pública sin firmar
    // (depende de la bucket policy — si ya está abierta para gallery/*, no hace falta ACL).
  })
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  })
  return { uploadUrl, key: args.key, expiresIn: PRESIGN_EXPIRES_SEC }
}

/**
 * Elimina un objeto del bucket. Silencia errores 404
 * (si el archivo ya no existe en S3, sigue siendo éxito desde el punto de vista del DELETE).
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    )
  } catch (err) {
    console.error(`Error eliminando ${key} de S3:`, err)
    // No relanzamos: el registro en BD debe poder borrarse aunque el objeto ya no exista
  }
}

/**
 * Genera una key única bajo el prefijo de galería.
 * Ej: gallery/abc123-xyz789.jpg
 */
export function buildGalleryKey(id: string, originalFilename: string): string {
  const ext = (originalFilename.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase()
  return `${GALLERY_PREFIX}${id}.${ext}`
}
