// src/lib/s3.ts
// S3 helpers. The client uses the SDK's "default credential provider chain":
//   1. Environment variables (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
//   2. ~/.aws/credentials (profile)
//   3. EC2 Instance Profile (in production)
//   4. ECS / Lambda / etc. role
//
// Local development: run `aws configure` or export the variables in .env.local.
// Production (EC2 with Instance Profile): you do NOT need keys in .env.

import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ── Constants ─────────────────────────────────────────────────
const PRESIGN_EXPIRES_SEC = 60 * 5         // 5 minutes to upload
export const GALLERY_PREFIX = 'gallery/'   // all gallery images live under this prefix
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024  // 5 MB

// ── Lazy client (same pattern as lib/email.ts) ────────────────
let _client: S3Client | null = null
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      // No `credentials`: the SDK uses the default chain.
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
 * Public URL for an object. If you set `AWS_S3_PUBLIC_BASE_URL`
 * (e.g. a CloudFront distribution), that base is used instead.
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
 * Generates a signed PUT URL so the admin's browser can upload
 * a file directly to S3.
 */
export async function getPresignedUploadUrl(args: {
  key: string
  contentType: string
}): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: args.key,
    ContentType: args.contentType,
    // So the object can be read publicly without signing
    // (depends on the bucket policy — if gallery/* is already open, no ACL is needed).
  })
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  })
  return { uploadUrl, key: args.key, expiresIn: PRESIGN_EXPIRES_SEC }
}

/**
 * Deletes an object from the bucket. Swallows 404 errors
 * (if the file no longer exists in S3, the DELETE still counts as success).
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
    // We don't rethrow: the DB record must still be deletable even if the object is gone
  }
}

/**
 * Builds a unique key under the gallery prefix.
 * E.g.: gallery/abc123-xyz789.jpg
 */
export function buildGalleryKey(id: string, originalFilename: string): string {
  const ext = (originalFilename.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase()
  return `${GALLERY_PREFIX}${id}.${ext}`
}
