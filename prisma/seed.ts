// prisma/seed.ts
import { PrismaClient, DayOfWeek } from '@prisma/client'
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

  const services = [
    { name: 'Manicure clásica',    description: 'Limpieza, corte, limado y esmalte tradicional.',   price: 25000, durationMinutes: 45, order: 1 },
    { name: 'Manicure en gel',     description: 'Larga duración, brillo intenso hasta 3 semanas.',   price: 45000, durationMinutes: 60, order: 2 },
    { name: 'Uñas acrílicas',      description: 'Extensiones de acrílico con diseño personalizado.', price: 70000, durationMinutes: 90, order: 3 },
    { name: 'Nail art básico',     description: 'Diseños simples: líneas, puntos, degradado.',        price: 15000, durationMinutes: 30, order: 4 },
    { name: 'Nail art elaborado',  description: 'Diseños complejos con piedras o aerógrafo.',         price: 30000, durationMinutes: 60, order: 5 },
    { name: 'Retiro gel/acrílico', description: 'Retiro seguro sin dañar la uña natural.',           price: 20000, durationMinutes: 30, order: 6 },
  ]
  for (const s of services) {
    await prisma.service.upsert({ where: { name: s.name }, update: s, create: s })
  }
  console.log('✅ 6 servicios creados/actualizados')

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
