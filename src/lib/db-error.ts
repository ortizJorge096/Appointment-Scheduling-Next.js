// src/lib/db-error.ts
// Detects Prisma connection errors and returns a friendly 503 response.

import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

/**
 * Prisma error codes related to the database being unavailable.
 * P1001 — Cannot reach the database server
 * P1008 — Operation timed out
 * P1017 — Server closed the connection
 * P2024 — Timed out fetching a connection from the pool
 */
const DB_UNAVAILABLE_CODES = new Set(['P1001', 'P1008', 'P1017', 'P2024'])

export function isDbUnavailable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true
  if (err instanceof Prisma.PrismaClientRustPanicError) return true
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    DB_UNAVAILABLE_CODES.has(err.code)
  ) return true
  return false
}

// Generic so it stays compatible with any NextResponse<ApiResponse<T>>
export function dbUnavailableResponse<T = never>(): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: false,
      error:
        'El servicio no está disponible temporalmente. Por favor intenta en unos minutos.',
    },
    {
      status: 503,
      headers: { 'Retry-After': '60' },
    }
  )
}
