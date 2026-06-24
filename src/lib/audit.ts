// src/lib/audit.ts
// Helper to record entries in the audit log.
// Called explicitly from every API route / flow that modifies data.

import { prisma } from './prisma'
import { AuditAction, AuditEntity, AuditActor } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export type { AuditAction, AuditEntity, AuditActor }

interface AuditParams {
  action:      AuditAction
  entity:      AuditEntity
  entityId:    string
  /** Who did it. Defaults to ADMIN (most calls are admin actions). */
  actorType?:  AuditActor
  userEmail?:  string
  ip?:         string
  userAgent?:  string
  /** Previous state (edits / status changes / cancellations). Never store secrets. */
  before?:     Prisma.InputJsonValue
  /** New state. Never store secrets (passwords, tokens). */
  after?:      Prisma.InputJsonValue
  /** Human-readable line, e.g. "Cliente Ana López reservó Manicura para el 12 dic". */
  description?: string
  metadata?:   Prisma.InputJsonValue
}

/**
 * Creates an entry in the audit log.
 * Never throws — an audit failure must not break the main operation.
 *
 * Safe to call WITHOUT awaiting (fire-and-forget): the app runs on a
 * persistent Node server, so the insert completes after the response is sent.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:      params.action,
        entity:      params.entity,
        entityId:    params.entityId,
        actorType:   params.actorType ?? 'ADMIN',
        userEmail:   params.userEmail,
        ip:          params.ip,
        userAgent:   params.userAgent,
        before:      params.before,
        after:       params.after,
        description: params.description,
        metadata:    params.metadata,
      },
    })
  } catch (err) {
    // Log on the server but don't propagate — the action already completed
    console.error('[audit] Error registrando entrada de auditoría:', err)
  }
}

/**
 * Extracts the client IP from the request headers.
 * Honors X-Forwarded-For (nginx-ingress / load balancer).
 */
export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers?.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return undefined
}

/** Extracts the User-Agent (device/browser) from the request headers. */
export function getUserAgent(request: Request): string | undefined {
  return request.headers?.get('user-agent') ?? undefined
}
