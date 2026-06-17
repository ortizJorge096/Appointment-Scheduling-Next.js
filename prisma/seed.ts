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
  // Las duraciones son estimaciones — ajústalas desde el panel admin.
  // ─────────────────────────────────────────────────────────────
  const services: Array<{
    name: string
    description?: string
    category: ServiceCategory
    price: number
    durationMinutes: number
    order: number
  }> = [
    // ── MANICURA ──
    { name: 'Manicura tradicional',              category: 'MANICURA', price: 25000, durationMinutes: 45,  order: 1,  description: 'Limpieza, corte, limado y esmalte tradicional.' },
    { name: 'Manicura semipermanente',           category: 'MANICURA', price: 40000, durationMinutes: 60,  order: 3,  description: 'Esmalte de larga duración con brillo intenso.' },
    { name: 'Manicura semipermanente + rubber',  category: 'MANICURA', price: 50000, durationMinutes: 75,  order: 5,  description: 'Base rubber para mayor resistencia y duración.' },
    { name: 'Recubrimiento en polygel',          category: 'MANICURA', price: 60000, durationMinutes: 90,  order: 6,  description: 'Refuerzo de la uña natural con polygel.' },
    { name: 'Recubrimiento en acrílico',         category: 'MANICURA', price: 65000, durationMinutes: 90,  order: 7,  description: 'Recubrimiento protector en acrílico.' },
    { name: 'Soft gel / press on',               category: 'MANICURA', price: 70000, durationMinutes: 75,  order: 8,  description: 'Uñas postizas de soft gel listas para usar.' },
    { name: 'Polygel con tips',                  category: 'MANICURA', price: 75000, durationMinutes: 120, order: 9,  description: 'Extensiones de polygel con tips.' },
    { name: 'Acrílico con tips',                 category: 'MANICURA', price: 80000, durationMinutes: 120, order: 10, description: 'Extensiones de acrílico con tips.' },
    { name: 'Polygel esculpido',                 category: 'MANICURA', price: 80000, durationMinutes: 120, order: 11, description: 'Extensiones esculpidas en polygel.' },
    { name: 'Acrílico esculpido',                category: 'MANICURA', price: 85000, durationMinutes: 120, order: 12, description: 'Extensiones esculpidas en acrílico.' },

    // ── PEDICURA ──
    { name: 'Pedicura tradicional',              category: 'PEDICURA', price: 25000, durationMinutes: 45,  order: 2,  description: 'Cuidado completo de pies con esmalte tradicional.' },
    { name: 'Pedicura semipermanente',           category: 'PEDICURA', price: 40000, durationMinutes: 60,  order: 4,  description: 'Esmaltado semipermanente para pies.' },

    // ── VIP (combos) ──
    { name: 'Manicura y pedicura tradicional',     category: 'VIP', price: 40000, durationMinutes: 90,  order: 13, description: 'Combo de manos y pies en esmalte tradicional.' },
    { name: 'Manicura y pedicura semipermanente',  category: 'VIP', price: 70000, durationMinutes: 120, order: 14, description: 'Combo de manos y pies en semipermanente.' },

    // ── CEJAS_PESTANAS ──
    { name: 'Lifting de pestañas',          category: 'CEJAS_PESTANAS', price: 70000,  durationMinutes: 60,  order: 15, description: 'Realza y curva tus pestañas naturales.' },
    { name: 'Pestañas clásicas',            category: 'CEJAS_PESTANAS', price: 70000,  durationMinutes: 90,  order: 16, description: 'Extensión pelo a pelo, efecto natural.' },
    { name: 'Efecto húmedo / pestañina',    category: 'CEJAS_PESTANAS', price: 75000,  durationMinutes: 90,  order: 17, description: 'Acabado definido tipo máscara.' },
    { name: 'Volumen brasilero YY',         category: 'CEJAS_PESTANAS', price: 80000,  durationMinutes: 120, order: 18, description: 'Volumen con fibras en Y para más densidad.' },
    { name: 'Volumen 3D',                   category: 'CEJAS_PESTANAS', price: 85000,  durationMinutes: 120, order: 19, description: 'Tres extensiones por pestaña natural.' },
    { name: 'Volumen 4D',                   category: 'CEJAS_PESTANAS', price: 90000,  durationMinutes: 120, order: 20, description: 'Cuatro extensiones por pestaña natural.' },
    { name: 'Volumen americano 5D / 6D',    category: 'CEJAS_PESTANAS', price: 100000, durationMinutes: 150, order: 21, description: 'Máximo volumen y densidad.' },
    { name: 'Efecto anime',                 category: 'CEJAS_PESTANAS', price: 110000, durationMinutes: 120, order: 22, description: 'Diseño en mechones marcados estilo anime.' },
    { name: 'Pestañas híbridas',            category: 'CEJAS_PESTANAS', price: 110000, durationMinutes: 120, order: 23, description: 'Mezcla de clásicas y volumen.' },
    { name: 'Depilación con cuchilla',        category: 'CEJAS_PESTANAS', price: 10000, durationMinutes: 15, order: 24, description: 'Perfilado con cuchilla.' },
    { name: 'Epilación con cera',             category: 'CEJAS_PESTANAS', price: 12000, durationMinutes: 20, order: 25, description: 'Depilación de cejas con cera.' },
    { name: 'Epilación con hilo hindú',       category: 'CEJAS_PESTANAS', price: 15000, durationMinutes: 20, order: 26, description: 'Técnica de hilo para mayor precisión.' },
    { name: 'Cejas semipermanentes / henna',  category: 'CEJAS_PESTANAS', price: 20000, durationMinutes: 45, order: 27, description: 'Tinte de cejas con henna.' },
    { name: 'Cejas personalizadas',           category: 'CEJAS_PESTANAS', price: 25000, durationMinutes: 30, order: 28, description: 'Diseño según tu rostro.' },
    { name: 'Cejas laminadas',                category: 'CEJAS_PESTANAS', price: 50000, durationMinutes: 60, order: 29, description: 'Laminado para cejas alineadas y definidas.' },
  ]

  for (const s of services) {
    await prisma.service.upsert({ where: { name: s.name }, update: s, create: s })
  }
  console.log(`✅ ${services.length} servicios creados/actualizados`)

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
