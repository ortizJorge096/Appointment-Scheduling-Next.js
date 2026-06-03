import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAvailableSlots } from '@/lib/availability'
import { STUDIO } from '@/lib/config'
import { toZonedTime } from 'date-fns-tz'
import { format, addDays } from 'date-fns'

export const dynamic = 'force-dynamic'

const MAX_DAYS_AHEAD = 14

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true, price: true, durationMinutes: true },
      orderBy: { order: 'asc' },
      take: 20,
    })

    if (services.length === 0) {
      return NextResponse.json({ success: true, data: null })
    }

    const nowBogota = toZonedTime(new Date(), STUDIO.timezone)
    const todayStr = format(nowBogota, 'yyyy-MM-dd')

    for (let day = 0; day < MAX_DAYS_AHEAD; day++) {
      const dateStr =
        day === 0
          ? todayStr
          : format(addDays(nowBogota, day), 'yyyy-MM-dd')

      for (const service of services) {
        try {
          const { slots } = await getAvailableSlots(dateStr, service.id)
          const firstAvailable = slots.find((s) => s.available)
          if (firstAvailable) {
            return NextResponse.json({
              success: true,
              data: {
                date: dateStr,
                startTime: firstAvailable.startTime,
                endTime: firstAvailable.endTime,
                service: {
                  id: service.id,
                  name: service.name,
                  price: service.price,
                  durationMinutes: service.durationMinutes,
                },
              },
            })
          }
        } catch {
          continue
        }
      }
    }

    return NextResponse.json({ success: true, data: null })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error al buscar disponibilidad' },
      { status: 500 },
    )
  }
}
