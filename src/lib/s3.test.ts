// src/lib/s3.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getPublicUrl, buildGalleryKey, GALLERY_PREFIX, MAX_UPLOAD_BYTES } from './s3'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('getPublicUrl', () => {
  beforeEach(() => {
    delete process.env.AWS_S3_PUBLIC_BASE_URL
    process.env.AWS_S3_BUCKET = 'my-bucket'
    process.env.AWS_REGION    = 'us-east-1'
  })

  it('returns S3 default URL when no custom base is set', () => {
    const url = getPublicUrl('gallery/img.jpg')
    expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/gallery/img.jpg')
  })

  it('uses custom base URL when AWS_S3_PUBLIC_BASE_URL is set', () => {
    process.env.AWS_S3_PUBLIC_BASE_URL = 'https://cdn.example.com'
    const url = getPublicUrl('gallery/img.jpg')
    expect(url).toBe('https://cdn.example.com/gallery/img.jpg')
  })

  it('strips trailing slash from custom base URL', () => {
    process.env.AWS_S3_PUBLIC_BASE_URL = 'https://cdn.example.com/'
    const url = getPublicUrl('gallery/img.jpg')
    expect(url).toBe('https://cdn.example.com/gallery/img.jpg')
  })

  it('uses us-east-1 as default region when AWS_REGION is not set', () => {
    delete process.env.AWS_REGION
    const url = getPublicUrl('gallery/img.jpg')
    expect(url).toContain('us-east-1')
  })
})

describe('buildGalleryKey', () => {
  it('builds key under gallery prefix', () => {
    const key = buildGalleryKey('abc123', 'photo.jpg')
    expect(key).toBe(`${GALLERY_PREFIX}abc123.jpg`)
  })

  it('lowercases the extension', () => {
    const key = buildGalleryKey('id1', 'PHOTO.JPG')
    expect(key).toContain('.jpg')
  })

  it('handles webp extension', () => {
    const key = buildGalleryKey('id2', 'image.webp')
    expect(key).toBe(`${GALLERY_PREFIX}id2.webp`)
  })

  it('handles png extension', () => {
    const key = buildGalleryKey('id3', 'image.png')
    expect(key).toBe(`${GALLERY_PREFIX}id3.png`)
  })

  it('falls back to jpg when extension is missing', () => {
    const key = buildGalleryKey('id4', 'imagewithnoext')
    expect(key).toBe(`${GALLERY_PREFIX}id4.jpg`)
  })
})

describe('constants', () => {
  it('GALLERY_PREFIX ends with slash', () => {
    expect(GALLERY_PREFIX).toBe('gallery/')
  })

  it('MAX_UPLOAD_BYTES is 5 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024)
  })
})
