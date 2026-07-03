# Guía de contribución — valentinajimenez

Estándares reales de este proyecto, verificados contra el código. Si algo aquí
no coincide con lo que ves en `src/`, gana el código y hay que corregir este
documento en el mismo PR que lo notó.

---

## 1. Stack y versiones

| Paquete | Versión | Notas |
|---|---|---|
| Next.js | 15.3.3 | App Router |
| React / react-dom | 18.3.0 | |
| TypeScript | 5.4.0 | |
| Prisma / @prisma/client | 5.14.0 | |
| NextAuth | 4.24.11 | |
| Tailwind CSS | 3.4.4 | |
| Zod | 3.23.0 | |
| date-fns / date-fns-tz | 3.6.0 / 3.1.3 | timezone `America/Bogota` |
| Vitest | 4.1.8 | unit/integration |
| @playwright/test | 1.49.1 | e2e |
| Node.js | ≥ 20.0.0 | ver `engines` en `package.json` |

Instalar y correr: `npm install && npm run dev`. Detalle completo de scripts,
variables de entorno y árbol de carpetas en [`STRUCTURE.md`](./STRUCTURE.md).

---

## 2. Estructura del proyecto

Regla corta — dónde va cada cosa:

| Qué | Dónde |
|---|---|
| Páginas y layouts | `src/app/**` (App Router) |
| Rutas de API | `src/app/api/**/route.ts` |
| Componentes primitivos reutilizables | `src/components/ui/` (`Card`, `ConfirmDialog`, `Toast`) |
| Componentes del panel admin | `src/components/admin/` |
| Componentes del sitio público | `src/components/public/` |
| Tipos TypeScript del dominio | `src/types/index.ts` (único archivo) |
| Schemas de validación Zod | `src/lib/validations.ts` (único archivo) |
| Helpers de negocio / infraestructura | `src/lib/*.ts` — cada uno con una responsabilidad: `auth.ts` (config NextAuth), `authz.ts` (sesión + permisos por request), `permissions.ts` (matriz de roles), `audit.ts` (log de auditoría), `availability.ts` (slots), `email.ts`, `s3.ts`, `db-error.ts`, `config.ts`, `utils.ts` |
| Hooks | `src/hooks/` (datos) y `src/components/admin/usePermissionGuard.ts` (autorización de UI) |
| Tests unitarios/integración | junto al archivo que testean, `*.test.ts(x)` |
| Tests e2e | `e2e/*.spec.ts` (Playwright) |
| Scripts operativos (cron, seeds, deploy) | `scripts/` |

No crees una carpeta nueva (`src/features/`, `src/domain/`, etc.) sin revisar
si ya existe un lugar para eso — este proyecto usa la estructura plana de
arriba, no arquitectura por features.

---

## 3. Reglas de TypeScript

- **`any` está prohibido.** Hoy hay **0** ocurrencias de `: any` en `src/` — es
  una regla que ya se cumple, no aspiracional. Si `any` parece la única
  salida, usa `unknown` + type guard, o revisa si el tipo ya existe en Prisma.
- **Enums de Prisma, nunca redefinidos.** Importa el enum generado
  (`import { Role } from '@prisma/client'`) y valida con `z.nativeEnum()`:

  ```ts
  // BIEN — src/lib/validations.ts:567
  role: z.nativeEnum(Role).default(Role.ADMIN)
  ```

- **Tipos derivados de Prisma cuando el tipo es 1:1 con un modelo.** Usa
  `Prisma.XxxGetPayload<>`, `Pick`, `Omit` o `Partial` en vez de copiar campos
  a mano. `src/types/index.ts` hoy define varias interfaces de dominio
  manualmente (`ClientSummary`, `AppointmentWithService`, etc.) — es aceptable
  para tipos **compuestos** que combinan varias entidades o dan forma a un
  input (`CreateAppointmentInput`), pero para un tipo que es literalmente "un
  registro de la tabla X con estas relaciones", prefiere `GetPayload`.
- **`interface` vs `type`**: `interface` para la forma de un objeto o props de
  componente (`interface Props`, `interface ConfirmOptions`); `type` para
  uniones, alias o tipos derivados (`type Permission = keyof typeof
  PERMISSIONS`, `type AppointmentSource = 'ONLINE' | 'WHATSAPP' | ...`).

---

## 4. Reglas de base de datos (Prisma)

- **Nunca hardcodear un enum que ya existe en el schema.** Ejemplo real de lo
  que NO hacer, y lo que sí:

  ```ts
  // MAL — src/lib/validations.ts:47 (DiscountType ya existe en el schema)
  descuentoTipo: z.enum(['PORCENTAJE', 'VALOR_FIJO']).nullable().optional()

  // BIEN
  descuentoTipo: z.nativeEnum(DiscountType).nullable().optional()
  ```

- **Queries con `select` explícito**, nunca traer el registro completo si no
  hace falta:

  ```ts
  // src/app/api/services/route.ts
  const services = await prisma.service.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, name: true, price: true, /* ... */ },
  })
  ```

- **Transacciones cuando se tocan varias tablas o hay una condición de carrera
  que evitar** (dos patrones válidos, ambos en uso):

  ```ts
  // callback — src/app/api/appointments/route.ts
  await prisma.$transaction(async (tx) => {
    const conflict = await tx.appointment.findFirst({ /* ... */ })
    // crear/validar dentro de la misma tx
  })

  // array — src/app/api/vip-config/route.ts
  await prisma.$transaction([
    prisma.vipDiscountTier.deleteMany({}),
    prisma.vipDiscountTier.createMany({ data: tiers }),
  ])
  ```

- **Índices en campos de búsqueda frecuente.** `Appointment` ya indexa `date`,
  `clientEmail`, `clientId`, `status`, `paymentStatus`, `professionalId`,
  `origin`, y `clientName` (GIN trigram para búsqueda parcial). Si agregas un
  campo por el que vas a filtrar seguido, agrégale `@@index`.
- **Soft delete obligatorio para entidades de negocio** — usa `deletedAt` +
  `isActive`, nunca `.delete()`:

  ```ts
  // src/app/api/services/[id]/route.ts
  await prisma.service.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  })
  ```

  Aplica a `Category`, `Service`, `Professional`, `Testimonial`. Excepciones
  aceptadas hoy: `GalleryImage` (el hard delete también borra el objeto en
  S3, no hay historial de negocio que preservar), `BlockedDate` (dato efímero
  de calendario), `User` (hard delete permitido **solo** si el admin no tiene
  historial de auditoría — ver el guard real en
  `src/app/api/users/[id]/route.ts:130-138`).
- **Fechas siempre en `America/Bogota`**, centralizado — nunca instancies
  timezone a mano:

  ```ts
  import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
  const today = formatInTimeZone(new Date(), 'America/Bogota', 'yyyy-MM-dd')
  ```

---

## 5. Reglas de API routes

Toda ruta en `src/app/api/**/route.ts` sigue este orden:

```ts
export async function POST(request: NextRequest) {
  // 1. Sesión
  const admin = await getCurrentAdmin()
  if (!admin) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  // 2. Permiso
  if (!hasPermission(admin.role, 'servicios:editar'))
    return NextResponse.json({ success: false, error: 'Sin permiso' }, { status: 403 })

  // 3. Validación
  const parsed = createServiceSchema.safeParse(await request.json())
  if (!parsed.success)
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 })

  // 4. Operación + auditoría
  const service = await prisma.service.create({ data: parsed.data })
  await audit({ action: 'CREATE', entity: 'SERVICE', entityId: service.id, userEmail: admin.email, ip: getClientIp(request) })

  return NextResponse.json({ success: true, data: service }, { status: 201 })
}
```

(código real, `src/app/api/services/route.ts`)

- **Validación con Zod en todo endpoint que reciba body/query**, sin excepción.
- **Sesión antes que nada**: `getCurrentAdmin()` (de `src/lib/authz.ts`), no
  `getServerSession` suelto en cada ruta.
- **Permisos con `hasPermission(role, 'modulo:accion')`**, nunca
  `session.role === 'ADMIN'`. La única excepción real en el código es un
  guardarraíl de negocio, no una verificación de permiso — evitar que se
  quede la app sin ningún `SUPER_ADMIN`:
  `src/app/api/users/[id]/route.ts:24,61`. No repliques ese patrón para
  controlar acceso; es específico a proteger esa invariante.
- **Status codes en uso**: `200` éxito con datos · `201` creación · `400`
  validación fallida · `401` sin sesión · `403` sin permiso · `404` no
  encontrado · `409` conflicto (email duplicado, slot ya tomado) · `429`
  rate limit (ver `src/app/api/appointments/route.ts`, creación pública) ·
  `500` error del servidor.
- **Respuesta consistente**: `{ success: true, data }` en éxito,
  `{ success: false, error }` en fallo. Siempre con esa forma, siempre con
  `success`.
- **Errores de Prisma manejados explícitamente**: `isDbUnavailable(err)`
  (`src/lib/db-error.ts`) para caídas de conexión → 503, y códigos
  específicos como `P2025` (no encontrado) o `P2002` (unique constraint) →
  mensaje de negocio, no el stack de Prisma.
- **Auditoría en toda mutación de admin** — ver sección 10.

---

## 6. Reglas de componentes

- **No dupliques** — antes de escribir un modal de confirmación, un card o un
  toast, revisa `src/components/ui/`. Ya existen `Card`/`DarkCard`/`StatCard`,
  `ConfirmDialog` (`useConfirm()`) y `Toast` (`useToast()`).
- **Server vs Client**:
  - Server (sin `'use client'`) cuando el componente hace fetch directo de
    Prisma y no necesita interactividad — ej. `src/app/admin/(protected)/page.tsx`
    (dashboard, `prisma.appointment.findMany()` en el propio componente).
  - Client (`'use client'`) cuando hay `useState`/`useEffect`/handlers de
    evento — ej. `BookingForm.tsx` (formulario multi-paso), `CitasList.tsx`
    (filtros con fetch debounced).
- **Props tipadas explícitamente** en todo componente exportado/reutilizable:

  ```ts
  // src/components/public/DateTimePicker.tsx
  interface Props {
    serviceId?: string
    selectedDate: string
    onDateChange: (date: string) => void
    disabled?: boolean
  }
  export default function DateTimePicker({ ... }: Props) { ... }
  ```

- **Loading states**: skeleton con `animate-pulse` (no spinners genéricos):

  ```tsx
  {loading ? (
    <div className="h-28 bg-beige-dark animate-pulse rounded-2xl" />
  ) : ( ... )}
  ```

- **Estados vacíos**: mensaje centrado + acción sugerida cuando aplica:

  ```tsx
  {appointments.length === 0 && (
    <div className="py-16 text-center text-ink-muted text-sm">
      No hay citas con los filtros seleccionados.
      {hasFilters && <button onClick={clearAll} className="btn-secondary text-xs">Limpiar filtros</button>}
    </div>
  )}
  ```

- **Confirmación antes de acciones destructivas** con `useConfirm()`:

  ```ts
  const confirm = useConfirm()
  async function remove() {
    if (!(await confirm({ message: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar gasto', danger: true })))
      return
    // ...
  }
  ```

- **Feedback tras cada acción async**: usa `useToast()` (`src/components/ui/Toast.tsx`)
  para confirmar éxito o mostrar el error — no dejes una mutación sin
  respuesta visible para quien la disparó.

---

## 7. Sistema de diseño

Fuente de verdad: `tailwind.config.ts` + `src/app/globals.css`. Estos son los
valores **reales** en uso — no un target aspiracional.

**Paleta** (definida como CSS vars y extendida en Tailwind):

| Token | Valor | Uso |
|---|---|---|
| `gold` | `#B8932A` | acción primaria, énfasis |
| `gold-light` / `gold-pale` / `gold-dark` | `#D4AD5A` / `#F5EDDA` / `#8A6E1E` | hover, fondos suaves, texto secundario dorado |
| `beige` | `#F2EBD9` | fondo de página |
| `beige-dark` / `beige-deeper` | `#E8DCC4` / `#D9CCAF` | bordes, skeletons |
| `ink` | `#1A1209` | texto principal |
| `ink-soft` / `ink-mid` / `ink-muted` | `#2A2014` / `#4A4035` / `#7A7060` | jerarquía de texto |

**Tipografía** (Google Fonts, cargadas en `globals.css`):
- `font-serif` → **Cormorant Garamond** (títulos, `h1`–`h4` por defecto)
- `font-sans` → **DM Sans** (cuerpo, default de `body`)
- `font-script` → **Great Vibes** (solo logo/firma, uso puntual)

**Border-radius** — no hay un valor fijo en px, se usan las clases utilitarias
ya definidas en `globals.css`:
- Botones (`.btn-primary`, `.btn-secondary`, `.btn-outline-gold`) → `rounded-full`
- Inputs (`.input-field`, `.select-field`) → `rounded-lg`
- Modales (`ConfirmDialog`) → `rounded-xl`
- Tarjetas de contenido → `rounded-2xl`

Reutiliza las clases de componente ya existentes (`.btn-primary`,
`.input-field`, `.form-label`, `.badge-*`) en vez de escribir utilidades
Tailwind sueltas que repliquen el mismo estilo.

**Iconos**: SVG propios en `src/components/public/ServiceIcons.tsx`
(`viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth={1.4}`) — este
proyecto **no** usa `lucide-react`. Si necesitas un ícono nuevo, síguele el
mismo patrón en ese archivo.

**Mobile first**: todo cambio de UI se revisa en 390px y 430px de ancho antes
de darlo por terminado.

---

## 8. Reglas de formularios

Patrón real (`BookingForm.tsx`, `ManualAppointmentModal.tsx`) — `useState`
manual, no `react-hook-form`:

```ts
const [touched, setTouched] = useState<Touched>({})

function handleBlur(key: keyof typeof EMPTY) {
  return () => {
    setTouched((t) => ({ ...t, [key]: true }))
    setFieldErrors((fe) => ({ ...fe, [key]: validateField(key) }))
  }
}

// Render: solo muestra el error si el campo fue tocado
{touched.clientName && fieldErrors.clientName && <p className="text-xs text-red-500">{fieldErrors.clientName}</p>}
```

- Valida **on blur** (no on change) y valida todo de nuevo **al submit**,
  marcando todos los campos como `touched` para que se vean los errores
  pendientes.
- Labels con `.form-label`, placeholders que ilustran el formato esperado
  (`"300 000 0000"`), no texto decorativo.
- Campos requeridos marcados con `*`.
- **Teléfono siempre `string`**, nunca `number` — se valida por cantidad de
  dígitos, no por longitud de caracteres, para tolerar espacios/guiones.

---

## 9. Reglas de seguridad

- **Doble verificación**: la validación en el formulario es UX; la que
  importa es la del endpoint (mismo schema Zod, o uno equivalente). Nunca
  confíes en que el frontend ya filtró el dato.
- **Ocultar, no solo deshabilitar** elementos sin permiso — y aun así, la API
  es el límite real:

  ```ts
  // src/components/admin/usePermissionGuard.ts
  export function useCan(): (permission: Permission) => boolean { ... }
  // uso: {can('servicios:editar') && <button>Editar</button>}
  ```

- **Secrets solo en variables de entorno** (`.env.local`, nunca commiteado;
  ver `.env.example` para la lista real de variables).
- **Rate limiting** en endpoints públicos sensibles — ejemplo real en
  `src/app/api/appointments/route.ts` (creación pública de citas, 429).
- **CSP**: no está configurado todavía en este proyecto. Si vas a tocar
  headers de seguridad, es terreno nuevo, no un estándar existente que
  replicar.

---

## 10. Reglas de auditoría

Helper único: `src/lib/audit.ts`.

```ts
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { /* ... */ } })
  } catch (err) {
    console.error('[audit] Error registrando entrada de auditoría:', err)
    // nunca propaga — la operación principal ya se completó
  }
}
```

- Se llama **explícitamente** desde cada ruta que crea/edita/borra/cambia
  estado — no hay middleware automático.
- Es seguro llamarlo **sin `await`** (fire-and-forget): si falla, se loggea
  con `console.error` y no rompe la respuesta al usuario.
- Guarda siempre: `action`, `entity`, `entityId`, `userEmail` (quién),
  `createdAt` (automático). `before`/`after` en JSON cuando hay estado que
  comparar (ediciones, cambios de estado).
- **Nunca** guardes contraseñas, tokens ni datos sensibles en `before`/
  `after`/`metadata`.
- `AuditLog` es de solo inserción — no hay ni debe haber `update`/`delete`
  sobre ese modelo en el código de la app.

---

## 11. Reglas de permisos

Matriz completa en `src/lib/permissions.ts` — 4 roles (`SUPER_ADMIN`,
`ADMIN`, `RECEPCIONISTA`, `SOLO_LECTURA`) y permisos granulares tipo
`'citas:editar'`, `'contabilidad:ver'`.

- **Backend**: `hasPermission(admin.role, 'modulo:accion')` en cada ruta (ver
  sección 5). Nunca compares el string de rol directamente.
- **Frontend**: dos hooks ya existentes en
  `src/components/admin/usePermissionGuard.ts`:
  - `usePermissionGuard(permission)` — redirige a `/admin/no-autorizado` si
    la página completa requiere un permiso que el admin no tiene.
  - `useCan()` — devuelve un checker `can(permission)` para ocultar controles
    puntuales (botones de editar/eliminar) en una página que sí puede ver.
- La UI es una capa de UX; la API sigue siendo el límite de seguridad real —
  así lo dice el comentario del propio hook.

---

## 12. Reglas de commits

Convención real usada consistentemente en el historial — Conventional
Commits, pero **con el scope en español** (dominio del negocio) y la
descripción en inglés:

```
feat(citas): per-service discounts and extras on the appointment detail
fix(citas): show discount and final total in the appointment summary card
refactor(validations): derive user role from Prisma Role enum
test(discount): cover computeAppointmentTotal
```

- Formato: `type(scope): description`
- Tipos: `feat` / `fix` / `refactor` / `style` / `perf` / `test` / `chore` / `docs`
- Scope: en español, el módulo de negocio afectado (`citas`, `horarios`,
  `contabilidad`, `validations`, `gallery`, `analytics`, etc.)
- Descripción: inglés, imperativo (`add` no `added`), sin punto final, ≤72
  caracteres en la primera línea.
- Agrupa cambios relacionados en un commit — no uno por archivo.

---

## 13. Reglas de pruebas

- **Unit/integration (Vitest)**: colocados junto al código que testean
  (`src/lib/discount.test.ts` junto a `discount.ts`). Config en
  `vitest.config.ts` (`environment: jsdom`, timeout 20s).
- **E2E (Playwright)**: en `e2e/*.spec.ts`, corre contra build de producción.
  Tres flujos cubiertos hoy: reserva pública (`agendar.spec.ts`), cancelación
  (`cancelar.spec.ts`), creación manual de cita en admin (`admin.spec.ts`).
- **Enums en tests**: importa el enum de Prisma cuando testeas lógica de
  validación (`import { Role } from '@prisma/client'`,
  `src/lib/validations.admin.test.ts`) en vez de hardcodear el string. Hay
  mocks de API existentes que hardcodean `status: 'CONFIRMED'` — no repliques
  ese patrón en tests nuevos, hazlos importar el enum.
- **Mocks actualizados**: si cambias un modelo de Prisma, revisa los mocks de
  `prisma.$transaction` y de los métodos del modelo en los tests que los usan.

---

## 14. Patrones prohibidos — nunca hacer esto

| ❌ Mal | ✅ Bien |
|---|---|
| `z.enum(['PORCENTAJE', 'VALOR_FIJO'])` | `z.nativeEnum(DiscountType)` |
| `session.role === 'ADMIN'` para controlar acceso | `hasPermission(admin.role, 'modulo:accion')` |
| `any` en TypeScript | Tipar correctamente, o `unknown` + guard |
| `prisma.expense.delete(...)` | `prisma.expense.update({ data: { deletedAt: new Date() } })` |
| Query sin `select` que trae el registro completo | `select` explícito con solo los campos que usas |
| Validar solo en el formulario | Validar también en la ruta API con el mismo schema |
| Fecha sin timezone explícito | `formatInTimeZone(date, 'America/Bogota', ...)` |
| Secret en el código | Siempre en `.env.local` / `.env.example` como plantilla |
| Componente nuevo cuando ya existe uno similar en `ui/` | Reutilizar o extender `Card`/`ConfirmDialog`/`Toast` |
| `fetch` sin manejo de error | `safeParse` + `try/catch` alrededor de las llamadas a Prisma |

### Deuda técnica conocida (detectada al escribir esta guía)

Estos archivos violan una regla de arriba hoy — no son el estándar a seguir,
son candidatos a corregir en un PR aparte:

- **Enums Zod hardcodeados** en `src/lib/validations.ts` (líneas 47, 87, 94,
  201-211, 304, 395, 432, 477): `descuentoTipo`, `status`, `paymentStatus`,
  `paymentMethod`, `dayOfWeek`, testimonial `status`, `source`, expense
  `category` — todos tienen su enum equivalente en `prisma/schema.prisma` y
  deberían usar `z.nativeEnum()`.
- **Hard delete en `src/app/api/expenses/[id]/route.ts`**: `Expense` es un
  registro contable y hoy se borra físicamente con `prisma.expense.delete()`.
  Debería migrar a soft delete (`deletedAt`) como `Category`/`Service`.
- **`src/types/index.ts`** define interfaces de dominio a mano en vez de
  usar `Prisma.XxxGetPayload<>` para los tipos que son 1:1 con un modelo.
- **`Appointment.startTime` / `Appointment.endTime`** no tienen `@@index`
  aunque se consultan en cada cálculo de disponibilidad.

---

## 15. Checklist antes de hacer PR

- [ ] Leí el código existente antes de escribir uno nuevo
- [ ] Reutilicé componentes y helpers existentes (`ui/`, `src/lib/`)
- [ ] Validación con Zod en frontend Y en la ruta API
- [ ] Permisos verificados con `hasPermission()` (backend) y `useCan()`/`usePermissionGuard()` (UI)
- [ ] `audit()` llamado en toda mutación de admin
- [ ] Sin enums hardcodeados — uso `z.nativeEnum()`
- [ ] Loading states y estados vacíos implementados
- [ ] Confirmación (`useConfirm()`) antes de acciones destructivas
- [ ] Probado en 390px y 430px de ancho
- [ ] Sin `console.log` de depuración ni código comentado
- [ ] Tests actualizados si cambié lógica existente; enums importados de Prisma, no hardcodeados
- [ ] Commits en Conventional Commits: `type(scope-español): description in English`

---

*Este documento describe el código tal como es hoy. Si agregas un patrón
nuevo o cambias uno de los listados aquí, actualiza esta guía en el mismo PR
— si no, empieza a mentir y deja de ser útil.*
