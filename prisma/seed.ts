// prisma/seed.ts
import { PrismaClient, DayOfWeek } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Category slugs match what the migration seeds; keep them stable.
type CategorySlug = 'UNAS' | 'PESTANAS' | 'CEJAS' | 'CORTE' | 'PROMOS'

async function main() {
  console.log('🌱 Iniciando seed...')

  const passwordHash = await bcrypt.hash('Admin123!', 12)
  await prisma.user.upsert({
    where:  { email: 'admin@vjbeautystudio.com' },
    update: {},
    create: { email: 'admin@vjbeautystudio.com', password: passwordHash, name: 'Admin', role: 'SUPER_ADMIN' },
  })
  console.log('✅ Admin (SUPER_ADMIN) — admin@vjbeautystudio.com / Admin123!')

  // ─────────────────────────────────────────────────────────────
  // CATEGORIES — now they live in the DB. Upsert by slug (stable) so the seed
  // is idempotent and coexists with the initial migration.
  // ─────────────────────────────────────────────────────────────
  const categorySeed: Array<{ slug: CategorySlug; name: string; description: string; icon: string; order: number }> = [
    { slug: 'UNAS',     name: 'Uñas',             description: 'Manicura, pedicura, gel, acrílico y nail art', icon: 'manicura', order: 1 },
    { slug: 'PESTANAS', name: 'Pestañas',         description: 'Lifting, extensiones, volumen e híbridas',     icon: 'pestanas', order: 2 },
    { slug: 'CEJAS',    name: 'Cejas',            description: 'Depilación, henna, diseño y laminado',         icon: 'cejas',    order: 3 },
    { slug: 'CORTE',    name: 'Corte de Cabello', description: 'Corte, peinado y diseño de flequillo',         icon: 'corte',    order: 4 },
    { slug: 'PROMOS',   name: 'Promos',           description: 'Combos con precio especial',                   icon: 'promo',    order: 5 },
  ]
  const categoryId: Record<CategorySlug, string> = {} as Record<CategorySlug, string>
  for (const c of categorySeed) {
    const cat = await prisma.category.upsert({
      where:  { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon, order: c.order },
      create: { slug: c.slug, name: c.name, description: c.description, icon: c.icon, order: c.order },
    })
    categoryId[c.slug] = cat.id
  }
  console.log(`✅ ${categorySeed.length} categorías creadas/actualizadas`)

  // ─────────────────────────────────────────────────────────────
  // REAL CATALOG (Valentina Jimenez Beauty Studio price list)
  // Durations and prices are estimates — adjust them from the admin panel.
  // ─────────────────────────────────────────────────────────────
  const services: Array<{
    name: string
    description?: string
    category: CategorySlug
    price: number
    durationMinutes: number
    order: number
  }> = [
    // ── NAILS ──
    { name: 'Manicura tradicional',              category: 'UNAS', price: 25000, durationMinutes: 45,  order: 1,  description: 'Limpieza, corte, limado y esmalte tradicional.' },
    { name: 'Pedicura tradicional',               category: 'UNAS', price: 25000, durationMinutes: 45,  order: 2,  description: 'Cuidado completo de pies con esmalte tradicional.' },
    { name: 'Manicura semipermanente',            category: 'UNAS', price: 40000, durationMinutes: 60,  order: 3,  description: 'Esmalte de larga duración con brillo intenso.' },
    { name: 'Pedicura semipermanente',            category: 'UNAS', price: 40000, durationMinutes: 60,  order: 4,  description: 'Esmaltado semipermanente para pies.' },
    { name: 'Semipermanente + rubber',            category: 'UNAS', price: 50000, durationMinutes: 75,  order: 5,  description: 'Base rubber para mayor resistencia y duración.' },
    { name: 'Recubrimiento en polygel',           category: 'UNAS', price: 60000, durationMinutes: 90,  order: 6,  description: 'Refuerzo de la uña natural con polygel.' },
    { name: 'Recubrimiento en acrílico',          category: 'UNAS', price: 65000, durationMinutes: 90,  order: 7,  description: 'Recubrimiento protector en acrílico.' },
    { name: 'Soft gel / press on',                category: 'UNAS', price: 70000, durationMinutes: 75,  order: 8,  description: 'Uñas postizas de soft gel listas para usar.' },
    { name: 'Polygel con tips',                   category: 'UNAS', price: 75000, durationMinutes: 120, order: 9,  description: 'Extensiones de polygel con tips.' },
    { name: 'Acrílico con tips',                  category: 'UNAS', price: 80000, durationMinutes: 120, order: 10, description: 'Extensiones de acrílico con tips.' },
    { name: 'Polygel esculpido',                  category: 'UNAS', price: 80000, durationMinutes: 120, order: 11, description: 'Extensiones esculpidas en polygel.' },
    { name: 'Acrílico esculpido',                 category: 'UNAS', price: 85000, durationMinutes: 120, order: 12, description: 'Extensiones esculpidas en acrílico.' },

    // ── LASHES ──
    { name: 'Lifting de pestañas',          category: 'PESTANAS', price: 70000,  durationMinutes: 60,  order: 20, description: 'Realza y curva tus pestañas naturales.' },
    { name: 'Pestañas clásicas',            category: 'PESTANAS', price: 70000,  durationMinutes: 90,  order: 21, description: 'Extensión pelo a pelo, efecto natural.' },
    { name: 'Efecto húmedo / pestañina',    category: 'PESTANAS', price: 75000,  durationMinutes: 90,  order: 22, description: 'Acabado definido tipo máscara.' },
    { name: 'Volumen brasilero YY',         category: 'PESTANAS', price: 80000,  durationMinutes: 120, order: 23, description: 'Volumen con fibras en Y para más densidad.' },
    { name: 'Volumen 3D/4D/5D/6D',          category: 'PESTANAS', price: 95000,  durationMinutes: 130, order: 24, description: 'Volumen progresivo según densidad deseada.' },
    { name: 'Efecto anime',                 category: 'PESTANAS', price: 110000, durationMinutes: 120, order: 25, description: 'Diseño en mechones marcados estilo anime.' },
    { name: 'Pestañas híbridas',            category: 'PESTANAS', price: 110000, durationMinutes: 120, order: 26, description: 'Mezcla de clásicas y volumen.' },

    // ── BROWS ──
    { name: 'Depilación con cuchilla',      category: 'CEJAS', price: 10000, durationMinutes: 15, order: 30, description: 'Perfilado con cuchilla.' },
    { name: 'Epilación con cera',           category: 'CEJAS', price: 12000, durationMinutes: 20, order: 31, description: 'Depilación de cejas con cera.' },
    { name: 'Epilación con hilo hindú',     category: 'CEJAS', price: 15000, durationMinutes: 20, order: 32, description: 'Técnica de hilo para mayor precisión.' },
    { name: 'Henna semipermanente',         category: 'CEJAS', price: 20000, durationMinutes: 45, order: 33, description: 'Tinte de cejas semipermanente con henna.' },
    { name: 'Cejas personalizadas',         category: 'CEJAS', price: 25000, durationMinutes: 30, order: 34, description: 'Diseño según tu rostro.' },
    { name: 'Cejas laminadas',              category: 'CEJAS', price: 50000, durationMinutes: 60, order: 35, description: 'Laminado para cejas alineadas y definidas.' },

    // ── HAIRCUT ──
    { name: 'Corte express / solo puntas',                      category: 'CORTE', price: 25000, durationMinutes: 30, order: 40, description: 'Despunte y mantenimiento rápido.' },
    { name: 'Corte personalizado (mariposa, bob, texturizado)', category: 'CORTE', price: 35000, durationMinutes: 60, order: 41, description: 'Corte a medida según tu estilo.' },
    { name: 'Diseño de flequillo',                              category: 'CORTE', price: 15000, durationMinutes: 20, order: 42, description: 'Corte y forma de flequillo.' },

    // ── PROMOS (fixed-price combos, cheaper than the individual sum) ──
    { name: 'Combo manicura y pedicura tradicional',     category: 'PROMOS', price: 42000, durationMinutes: 90,  order: 50, description: 'Manicura tradicional + Pedicura tradicional, precio combo.' },
    { name: 'Combo manicura y pedicura semipermanente',  category: 'PROMOS', price: 70000, durationMinutes: 120, order: 51, description: 'Manicura semipermanente + Pedicura semipermanente, precio combo.' },
  ]

  // Previous names whose wording changed — used to update the existing record
  // instead of duplicating it when the new name doesn't match exactly.
  const RENAMES: Record<string, string> = {
    'Manicura semipermanente + rubber':   'Semipermanente + rubber',
    'Volumen 3D':                         'Volumen 3D/4D/5D/6D',
    'Volumen 4D':                         'Volumen 3D/4D/5D/6D',
    'Volumen americano 5D / 6D':          'Volumen 3D/4D/5D/6D',
    'Cejas semipermanentes / henna':      'Henna semipermanente',
    'Manicura y pedicura tradicional':    'Combo manicura y pedicura tradicional',
    'Manicura y pedicura semipermanente': 'Combo manicura y pedicura semipermanente',
  }
  for (const [oldName, newName] of Object.entries(RENAMES)) {
    const existing = await prisma.service.findUnique({ where: { name: oldName } })
    if (!existing) continue

    const target = await prisma.service.findUnique({ where: { name: newName } })
    if (target) {
      // Another old name already claimed `newName` in a previous iteration
      // (e.g. "Volumen 3D" and "Volumen 4D" both collapse into "Volumen 3D/4D/5D/6D").
      // It's a duplicate from the old catalog: deactivate it instead of renaming
      // (not deleted — there may be historical appointments with this serviceId).
      await prisma.service.update({ where: { id: existing.id }, data: { isActive: false } })
      console.log(`  ⏸ Desactivado duplicado "${oldName}" (fusionado en "${newName}")`)
    } else {
      await prisma.service.update({ where: { id: existing.id }, data: { name: newName } })
      console.log(`  ↻ Renombrado "${oldName}" → "${newName}"`)
    }
  }

  for (const s of services) {
    const { category, ...rest } = s
    const data = { ...rest, categoryId: categoryId[category] }
    await prisma.service.upsert({ where: { name: s.name }, update: data, create: data })
  }
  console.log(`✅ ${services.length} servicios creados/actualizados`)

  // ─────────────────────────────────────────────────────────────
  // VIP DISCOUNT (multi-service) — configurable from the admin
  // 2 services → 10% · 3 services → 20% · 4+ services → 30%
  // ─────────────────────────────────────────────────────────────
  const tiers = [
    { minServices: 2, discountPct: 10 },
    { minServices: 3, discountPct: 20 },
    { minServices: 4, discountPct: 30 },
  ]
  for (const t of tiers) {
    await prisma.vipDiscountTier.upsert({
      where:  { minServices: t.minServices },
      update: { discountPct: t.discountPct },
      create: t,
    })
  }
  const existingConfig = await prisma.vipDiscountConfig.findFirst()
  if (!existingConfig) {
    await prisma.vipDiscountConfig.create({ data: { enabled: true } })
  }
  console.log('✅ Configuración de descuento VIP lista')

  // ─────────────────────────────────────────────────────────────
  // PROFESSIONALS — each one can serve one appointment at a time.
  // ─────────────────────────────────────────────────────────────
  // reviewCount = number of appointments each professional has served. Kept
  // consistent with the studio total (+300 appointments on the Home): the sum stays below.
  const professionals = [
    { name: 'Valentina J.', specialty: 'Especialista master',   rating: 4.9, reviewCount: 130, order: 1 },
    { name: 'Sofía L.',     specialty: 'Uñas & nail art',       rating: 4.8, reviewCount: 90,  order: 2 },
    { name: 'Mariana T.',   specialty: 'Pestañas & cejas',      rating: 4.8, reviewCount: 70,  order: 3 },
  ]
  for (const p of professionals) {
    const existing = await prisma.professional.findFirst({ where: { name: p.name } })
    if (existing) {
      await prisma.professional.update({ where: { id: existing.id }, data: p })
    } else {
      await prisma.professional.create({ data: p })
    }
  }
  console.log(`✅ ${professionals.length} profesionales creados/actualizados`)

  // Weekdays: 9–12 and 2–6 (lunch break 12:00–14:00). Weekends: not bookable
  // online — clients contact by WhatsApp.
  const schedules = [
    { dayOfWeek: DayOfWeek.MONDAY,    startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '14:00', isActive: true  },
    { dayOfWeek: DayOfWeek.TUESDAY,   startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '14:00', isActive: true  },
    { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '14:00', isActive: true  },
    { dayOfWeek: DayOfWeek.THURSDAY,  startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '14:00', isActive: true  },
    { dayOfWeek: DayOfWeek.FRIDAY,    startTime: '09:00', endTime: '18:00', breakStart: '12:00', breakEnd: '14:00', isActive: true  },
    { dayOfWeek: DayOfWeek.SATURDAY,  startTime: '09:00', endTime: '14:00', breakStart: null, breakEnd: null, isActive: false },
    { dayOfWeek: DayOfWeek.SUNDAY,    startTime: '09:00', endTime: '12:00', breakStart: null, breakEnd: null, isActive: false },
  ]
  for (const s of schedules) {
    await prisma.schedule.upsert({ where: { dayOfWeek: s.dayOfWeek }, update: s, create: s })
  }
  console.log('✅ Horarios actualizados')
  console.log('\n🎉 Seed completado!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
