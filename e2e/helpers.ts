// e2e/helpers.ts
import type { APIRequestContext } from '@playwright/test'

type Created = { id: string; token: string; date: string; startTime: string }

/**
 * Creates a real appointment via the public API on a future day (≥3 days ahead,
 * so it's outside the 24h cancellation window). Finds the first day with an open
 * slot. Returns the id + cancelToken for cancellation tests.
 */
export async function createFutureAppointment(request: APIRequestContext): Promise<Created> {
  const services = await (await request.get('/api/services')).json()
  if (!services?.success || !services.data?.length) throw new Error('No hay servicios sembrados')
  const serviceId = services.data[0].id

  for (let offset = 3; offset <= 30; offset++) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const date = d.toISOString().slice(0, 10)

    const av = await (await request.get(`/api/availability?date=${date}&serviceId=${serviceId}`)).json()
    const slot = av?.data?.slots?.find((s: { available: boolean }) => s.available)
    if (!slot) continue

    const res = await request.post('/api/appointments', {
      data: { clientName: 'E2E Cancelación', clientPhone: '3001234567', serviceId, date, startTime: slot.startTime },
    })
    const j = await res.json()
    if (!j.success) throw new Error('No se pudo crear la cita: ' + JSON.stringify(j))
    return { id: j.data.id, token: j.data.cancelToken, date, startTime: slot.startTime }
  }
  throw new Error('No se encontró un horario disponible en los próximos 30 días')
}
