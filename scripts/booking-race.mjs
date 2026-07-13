// scripts/booking-race.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Anti-double-booking CONCURRENCY test for the public booking flow.
//
// Fires N concurrent bookings for the SAME slot from N distinct simulated clients
// (distinct phone + X-Forwarded-For, so the per-IP rate limit and per-phone cap
// don't mask the race) and checks that only the expected number win — the rest
// must be rejected with 409. This exercises the REAL guard: the Serializable
// transaction + overlap re-check in POST /api/appointments.
//
// It is NOT a throughput/flood test (that isn't this app's risk). It stresses the
// correctness of concurrent writes to the same resource — the thing that would
// actually hurt: two people getting the same slot.
//
// ⚠️  Creates one real appointment (the winner). Run against local / dev / staging,
//     never production. Needs a running server with a seeded catalog + open hours.
//
// Usage:
//   node scripts/booking-race.mjs
//   BASE_URL=https://dev.vjbeautystudio.com CONCURRENCY=20 node scripts/booking-race.mjs
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const N    = Math.max(2, Number(process.env.CONCURRENCY ?? 10))
const DAYS = 30 // how far ahead to scan for an open slot

const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1) }

async function api(path, init) {
  const res  = await fetch(`${BASE}${path}`, init)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

function dateISO(offset) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

console.log(`\n▶ Prueba de carrera de reservas contra ${BASE} (concurrencia = ${N})`)

// 1) An active service.
const svc = await api('/api/services')
if (!svc.body?.success || !svc.body?.data?.length) fail('No hay servicios activos. ¿El server está corriendo y con seed?')
const service = svc.body.data[0]

// 2) An active professional if the studio uses them → the race is for a single
//    resource, so exactly one booking may win. Without professionals the server
//    assigns "primera disponible" (null), a different expectation (see below).
const pro = await api('/api/professionals')
const professionalId = pro.body?.data?.[0]?.id ?? null
const proName        = pro.body?.data?.[0]?.name ?? null

// 3) The first open slot for that (service, professional).
let date = null, startTime = null
for (let i = 0; i <= DAYS && !startTime; i++) {
  const d = dateISO(i)
  const q = new URLSearchParams({ date: d, serviceId: service.id })
  if (professionalId) q.set('professionalId', professionalId)
  const av   = await api(`/api/availability?${q}`)
  const slot = (av.body?.data?.slots ?? []).find((s) => s.available)
  if (slot) { date = d; startTime = slot.startTime }
}
if (!startTime) fail(`No encontré ningún horario disponible en ${DAYS} días para "${service.name}".`)

console.log(`  Servicio:     ${service.name}`)
console.log(`  Profesional:  ${proName ?? '— (primera disponible, sin profesionales)'}`)
console.log(`  Horario:      ${date} ${startTime}`)
console.log(`  Disparando ${N} reservas simultáneas al MISMO horario…\n`)

// 4) Fire N concurrent bookings for the exact same slot. Mapping synchronously and
//    awaiting Promise.all launches every fetch before any resolves → real contention.
function book(i) {
  const body = {
    clientName:  `Carrera ${i}`,
    clientPhone: `3${String(100000000 + i).slice(0, 9)}`, // distinct valid 10-digit phone
    serviceId:   service.id,
    date, startTime,
    elapsedMs:   5000, // clears the anti-bot time gate (>= 3s)
    website:     '',   // honeypot must stay empty
  }
  if (professionalId) body.professionalId = professionalId
  return api('/api/appointments', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Forwarded-For': `10.77.${Math.floor(i / 256)}.${i % 256}`, // distinct IP → distinct rate-limit bucket
    },
    body: JSON.stringify(body),
  })
}

const results = await Promise.all(Array.from({ length: N }, (_, i) => book(i)))
const wins   = results.filter((r) => r.status === 201)
const taken  = results.filter((r) => r.status === 409)
const others = results.filter((r) => r.status !== 201 && r.status !== 409)

console.log(`  201 creada:          ${wins.length}`)
console.log(`  409 horario tomado:  ${taken.length}`)
if (others.length) {
  console.log(`  otros:               ${others.length} →`,
    others.map((o) => `${o.status}:${o.body?.code ?? o.body?.error ?? ''}`).slice(0, 5))
}

// 5) Verdict.
if (others.length) {
  fail(`Hubo ${others.length} respuestas inesperadas (ni 201 ni 409). Suele ser rate-limit (429) o ` +
       `anti-bot (400): revisa que X-Forwarded-For llegue distinto por request, o baja CONCURRENCY.`)
}

if (professionalId) {
  if (wins.length === 1) {
    console.log(`\n✔ PASS — exactamente 1 reserva ganó y ${taken.length} fueron rechazadas. Sin doble reserva.`)
    process.exit(0)
  }
  fail(wins.length > 1
    ? `¡DOBLE RESERVA! ${wins.length} reservas ganaron el mismo (horario, profesional). ` +
      `El candado Serializable + re-chequeo de solape NO está protegiendo.`
    : `Se esperaba 1 ganadora y hubo ${wins.length}. Ninguna reserva prosperó — revisa el server.`)
} else {
  // No professionals configured: bookings are created with professionalId = null and
  // the "primera disponible" branch never blocks → same-slot concurrency isn't guarded.
  console.log('\n⚠ El estudio no tiene profesionales activos: las reservas se crean sin profesional asignado.')
  if (wins.length > 1) {
    fail(`${wins.length} reservas ganaron el MISMO horario sin profesional. Con 0 profesionales no hay ` +
         `candado por recurso. Configura al menos 1 profesional o valida si esto es aceptable para tu operación.`)
  }
  console.log(`✔ PASS — 1 ganadora, ${taken.length} rechazadas.`)
  process.exit(0)
}
