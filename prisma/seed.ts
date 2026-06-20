// prisma/seed.ts
import { PrismaClient, DayOfWeek, ServiceCategory } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const passwordHash = await bcrypt.hash('Admin123!', 12)
  await prisma.user.upsert({
    where:  { email: 'admin@vjbeautystudio.com' },
    update: {},
    create: { email: 'admin@vjbeautystudio.com', password: passwordHash, name: 'Admin', role: 'ADMIN' },
  })
  console.log('✅ Admin — admin@vjbeautystudio.com / Admin123!')

  // ─────────────────────────────────────────────────────────────
  // CATÁLOGO REAL (lista de precios Valentina Jimenez Beauty Studio)
  // Categorías: UNAS, PESTANAS, CEJAS, CORTE, PROMOS.
  // Las duraciones y precios son estimaciones — ajústalas desde el panel admin.
  // ─────────────────────────────────────────────────────────────
  const services: Array<{
    name: string
    description?: string
    category: ServiceCategory
    price: number
    durationMinutes: number
    order: number
  }> = [
    // ── UÑAS ──
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

    // ── PESTAÑAS ──
    { name: 'Lifting de pestañas',          category: 'PESTANAS', price: 70000,  durationMinutes: 60,  order: 20, description: 'Realza y curva tus pestañas naturales.' },
    { name: 'Pestañas clásicas',            category: 'PESTANAS', price: 70000,  durationMinutes: 90,  order: 21, description: 'Extensión pelo a pelo, efecto natural.' },
    { name: 'Efecto húmedo / pestañina',    category: 'PESTANAS', price: 75000,  durationMinutes: 90,  order: 22, description: 'Acabado definido tipo máscara.' },
    { name: 'Volumen brasilero YY',         category: 'PESTANAS', price: 80000,  durationMinutes: 120, order: 23, description: 'Volumen con fibras en Y para más densidad.' },
    { name: 'Volumen 3D/4D/5D/6D',          category: 'PESTANAS', price: 95000,  durationMinutes: 130, order: 24, description: 'Volumen progresivo según densidad deseada.' },
    { name: 'Efecto anime',                 category: 'PESTANAS', price: 110000, durationMinutes: 120, order: 25, description: 'Diseño en mechones marcados estilo anime.' },
    { name: 'Pestañas híbridas',            category: 'PESTANAS', price: 110000, durationMinutes: 120, order: 26, description: 'Mezcla de clásicas y volumen.' },

    // ── CEJAS ──
    { name: 'Depilación con cuchilla',      category: 'CEJAS', price: 10000, durationMinutes: 15, order: 30, description: 'Perfilado con cuchilla.' },
    { name: 'Epilación con cera',           category: 'CEJAS', price: 12000, durationMinutes: 20, order: 31, description: 'Depilación de cejas con cera.' },
    { name: 'Epilación con hilo hindú',     category: 'CEJAS', price: 15000, durationMinutes: 20, order: 32, description: 'Técnica de hilo para mayor precisión.' },
    { name: 'Henna semipermanente',         category: 'CEJAS', price: 20000, durationMinutes: 45, order: 33, description: 'Tinte de cejas semipermanente con henna.' },
    { name: 'Cejas personalizadas',         category: 'CEJAS', price: 25000, durationMinutes: 30, order: 34, description: 'Diseño según tu rostro.' },
    { name: 'Cejas laminadas',              category: 'CEJAS', price: 50000, durationMinutes: 60, order: 35, description: 'Laminado para cejas alineadas y definidas.' },

    // ── CORTE DE CABELLO ──
    { name: 'Corte express / solo puntas',                      category: 'CORTE', price: 25000, durationMinutes: 30, order: 40, description: 'Despunte y mantenimiento rápido.' },
    { name: 'Corte personalizado (mariposa, bob, texturizado)', category: 'CORTE', price: 35000, durationMinutes: 60, order: 41, description: 'Corte a medida según tu estilo.' },
    { name: 'Diseño de flequillo',                              category: 'CORTE', price: 15000, durationMinutes: 20, order: 42, description: 'Corte y forma de flequillo.' },

    // ── PROMOS (combos de precio fijo, menor que la suma individual) ──
    { name: 'Combo manicura y pedicura tradicional',     category: 'PROMOS', price: 42000, durationMinutes: 90,  order: 50, description: 'Manicura tradicional + Pedicura tradicional, precio combo.' },
    { name: 'Combo manicura y pedicura semipermanente',  category: 'PROMOS', price: 70000, durationMinutes: 120, order: 51, description: 'Manicura semipermanente + Pedicura semipermanente, precio combo.' },
  ]

  // Nombres anteriores que cambiaron de redacción — para actualizar el registro
  // existente en vez de duplicarlo cuando el nombre nuevo no coincide exactamente.
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
    if (existing) {
      await prisma.service.update({ where: { id: existing.id }, data: { name: newName } })
      console.log(`  ↻ Renombrado "${oldName}" → "${newName}"`)
    }
  }

  for (const s of services) {
    await prisma.service.upsert({ where: { name: s.name }, update: s, create: s })
  }
  console.log(`✅ ${services.length} servicios creados/actualizados`)

  // ─────────────────────────────────────────────────────────────
  // DESCUENTO VIP (multi-servicio) — parametrizable desde el admin
  // 2 servicios → 10% · 3 servicios → 20% · 4+ servicios → 30%
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
  // PROFESIONALES — cada uno puede atender una cita a la vez.
  // ─────────────────────────────────────────────────────────────
  const professionals = [
    { name: 'Valentina J.', specialty: 'Especialista master',   rating: 4.9, reviewCount: 1200, order: 1 },
    { name: 'Sofía L.',     specialty: 'Uñas & nail art',       rating: 4.8, reviewCount: 740,  order: 2 },
    { name: 'Mariana T.',   specialty: 'Pestañas & cejas',      rating: 4.9, reviewCount: 610,  order: 3 },
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

  const schedules = [
    { dayOfWeek: DayOfWeek.MONDAY,    startTime: '09:00', endTime: '18:00', isActive: true  },
    { dayOfWeek: DayOfWeek.TUESDAY,   startTime: '09:00', endTime: '18:00', isActive: true  },
    { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '09:00', endTime: '18:00', isActive: true  },
    { dayOfWeek: DayOfWeek.THURSDAY,  startTime: '09:00', endTime: '18:00', isActive: true  },
    { dayOfWeek: DayOfWeek.FRIDAY,    startTime: '09:00', endTime: '18:00', isActive: true  },
    { dayOfWeek: DayOfWeek.SATURDAY,  startTime: '09:00', endTime: '14:00', isActive: true  },
    { dayOfWeek: DayOfWeek.SUNDAY,    startTime: '09:00', endTime: '12:00', isActive: false },
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
