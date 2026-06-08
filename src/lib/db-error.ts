// src/lib/db-error.ts
// Detecta errores de conexión de Prisma y devuelve una respuesta 503 amigable.

import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

/**
 * Códigos de error de Prisma relacionados con la base de datos no disponible.
 * P1001 — No se puede conectar al servidor de BD
 * P1008 — Operación agotó el tiempo de espera
 * P1017 — El servidor cerró la conexión
 * P2024 — Timeout obteniendo conexión del pool
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

// Genérica para ser compatible con cualquier NextResponse<ApiResponse<T>>
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
