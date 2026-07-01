// src/app/api/categories/route.ts
// GET  /api/categories → list categories (public: active only; admin: all non-deleted)
// POST /api/categories → create category (admin)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getCurrentAdmin } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createCategorySchema } from '@/lib/validations'
import { audit, getClientIp } from '@/lib/audit'
import { slugify } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)

  // Active-only is the safe default for everyone — the public site must never
  // show inactive categories, even when an admin is logged in on the same
  // browser. Listing inactive ones is opt-in (admin catalog) and needs a session.
  const includeInactive =
    !!session && new URL(request.url).searchParams.get('includeInactive') === 'true'

  const categories = await prisma.category.findMany({
    // Soft-deleted categories never show.
    where: includeInactive ? { deletedAt: null } : { deletedAt: null, isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      order: true,
      isActive: true,
      _count: {
        select: { services: { where: { deletedAt: null } } },
      },
    },
  })

  return NextResponse.json({ success: true, data: categories })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (!hasPermission(admin.role, 'servicios:editar')) {
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const name = parsed.data.name.trim()

  // Reject duplicate names (case-insensitive) up front for a friendly message,
  // even though the DB also enforces uniqueness.
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true, deletedAt: true },
  })
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'Ya existe una categoría con ese nombre.' },
      { status: 409 }
    )
  }

  // Default order = next after the current max
  const last = await prisma.category.findFirst({
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const category = await prisma.category.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      description: parsed.data.description?.trim() || null,
      icon: parsed.data.icon ?? 'promo',
      order: parsed.data.order ?? (last?.order ?? 0) + 1,
    },
  })

  await audit({
    action:      'CREATE',
    entity:      'CATEGORY',
    entityId:    category.id,
    userEmail:   admin.email,
    ip:          getClientIp(request),
    description: `Categoría "${category.name}" creada`,
  })

  return NextResponse.json({ success: true, data: category }, { status: 201 })
}

// Generates a URL-safe slug unique across all categories (including soft-deleted,
// since slug has a DB unique constraint).
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'categoria'
  let slug = base
  let n = 1
  // Loop until no collision. Tiny table, so this is cheap.
  while (await prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
    n += 1
    slug = `${base}-${n}`
  }
  return slug
}
