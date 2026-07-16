// src/lib/db-error.test.ts
// Used in the catch of nearly every route: classifies Prisma connection errors
// and produces the friendly 503.
import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { isDbUnavailable, dbUnavailableResponse } from './db-error'

describe('isDbUnavailable', () => {
  it('true para init/panic (servidor inalcanzable)', () => {
    expect(isDbUnavailable(new Prisma.PrismaClientInitializationError('down', '5.0.0'))).toBe(true)
    expect(isDbUnavailable(new Prisma.PrismaClientRustPanicError('panic', '5.0.0'))).toBe(true)
  })

  it('true para los códigos de BD caída (P1001/P1008/P1017/P2024)', () => {
    for (const code of ['P1001', 'P1008', 'P1017', 'P2024']) {
      const err = new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5.0.0' })
      expect(isDbUnavailable(err)).toBe(true)
    }
  })

  it('false para otros errores conocidos (p.ej. P2002) y para errores genéricos', () => {
    expect(isDbUnavailable(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.0.0' }))).toBe(false)
    expect(isDbUnavailable(new Error('boom'))).toBe(false)
    expect(isDbUnavailable(null)).toBe(false)
    expect(isDbUnavailable(undefined)).toBe(false)
    expect(isDbUnavailable('string')).toBe(false)
  })
})

describe('dbUnavailableResponse', () => {
  it('503 con Retry-After y payload de error', async () => {
    const res = dbUnavailableResponse()
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('60')
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/no está disponible/i)
  })
})
