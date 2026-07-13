# ADR-011: Validación de arquitectura — Appointment-Scheduling-Next.js

**Estado:** Aceptado — acciones 1–4 implementadas
**Fecha:** 2026-07-12 · **Actualizado:** 2026-07-13
**Deciders:** Owner técnico del proyecto (Alexander)
**Alcance solicitado:** Arquitectura general · Elección tecnológica · Escalabilidad y rendimiento · Seguridad
**Criterio:** Adherencia a buenas prácticas y estándares actuales

---

## Contexto

Aplicación de reserva de citas para un estudio (Next.js 15 App Router + TypeScript). Reserva pública sin login, panel de administración con roles, base PostgreSQL en AWS RDS vía Prisma, despliegue en k3s/Kubernetes sobre EC2 con Terraform y CI/CD. Se evaluó el repositorio real: 39 rutas API, 46 módulos en `lib/`, 50 componentes, 78 archivos de test, 41 migraciones Prisma, headers de seguridad y CSP en `next.config.ts`, e infra en `infra/k8s` + `infra/terraform`.

El veredicto general es que el proyecto **ya sigue la gran mayoría de buenas prácticas**. Este documento confirma lo que está bien hecho y aísla un conjunto pequeño de brechas concretas —una de ellas real y accionable— para llevarlo a estándar de producción sin sobre-ingeniería.

---

## Decisión

Mantener la arquitectura y el stack actuales. Corregir un desajuste real entre el código y la infraestructura (rate limiting / throttling en memoria frente a despliegue multi-réplica) y adoptar un conjunto acotado de mejoras de robustez. No se recomienda ningún rediseño estructural.

---

## Hallazgos por dimensión

### 1. Arquitectura general — Sólida

Lo que está bien y es un estándar a mantener:

- **Separación de responsabilidades limpia y consistente.** `app/` (UI + rutas), `components/` segmentado en `public/ · admin/ · ui/`, `lib/` con un módulo por responsabilidad (`prisma`, `auth`, `authz`, `permissions`, `validations`, `audit`, `availability`, `email`, `s3`, `db-error`…), `hooks/` y `types/` aparte. Es una organización que escala y que un nuevo dev entiende rápido.
- **Un `route.ts` por recurso** siguiendo la convención documentada en `CONTRIBUTING.md`, con `STRUCTURE.md` describiendo el árbol. La documentación interna existe y está al día — poco común y muy valioso.
- **Singleton de PrismaClient** (`lib/prisma.ts`) evitando el clásico agotamiento de conexiones en dev por hot-reload.
- **Autorización centralizada.** `authz.ts` + `permissions.ts` exponen `getCurrentAdmin()` / `requirePermission()` con una matriz de roles (`ADMIN`, `SUPER_ADMIN`, `RECEPCIONISTA`, `SOLO_LECTURA`). El rol se re-lee del DB en el callback de sesión, así que las comprobaciones no gastan queries extra y nunca quedan obsoletas.
- **Validación de entrada con Zod centralizada** en `lib/validations.ts`.
- **Auditoría de primera clase** (`lib/audit.ts` + modelo `AuditLog`, con IP y user-agent), incluyendo export.

Ajuste menor: los helpers `requirePermission` devuelven `null` en vez de lanzar; hay que confiar en que cada ruta traduzca ese `null` a un `401/403`. Es correcto, pero conviene un test que garantice que ninguna ruta olvide el guard (ver Acciones).

### 2. Elección tecnológica — Actual y bien justificada

| Dimensión | Evaluación |
|-----------|------------|
| Complejidad | Media — apropiada al dominio |
| Costo | Bajo (single EC2 t3.medium, RDS, S3, Resend) |
| Escalabilidad | Buena base (Prisma + Postgres + K8s/HPA) |
| Familiaridad del equipo | Alta (stack mainstream) |

- Next.js 15.3 (App Router) + React 19 + TypeScript 5.4 + Prisma 5.14 + Tailwind 3.4: stack moderno y bien soportado.
- Vitest + Playwright para unit/integración y e2e — estándar de facto hoy.
- Elecciones de dominio acertadas: `date-fns-tz` con zona fija `America/Bogota` (evita bugs de zona horaria, el error nº1 en apps de agenda), `pg_trgm` + índices GIN para la búsqueda `ILIKE` del admin, presigned URLs de S3 para subir imágenes sin proxyear por el backend.

Puntos a vigilar (no bloqueantes):

- **NextAuth v4.24.** Auth.js v5 es la línea actual; v4 sigue soportada, pero conviene planear la migración a mediano plazo antes de que entre en modo mantenimiento.
- **Versiones muy nuevas de tooling** (`vite ^8`, `vitest 4.1.8`). Están bien, pero fija (pin) versiones exactas de la cadena de test para evitar que un minor rompa el CI.

### 3. Escalabilidad y rendimiento — Un desajuste real que corregir

**Hallazgo principal (accionable):** el rate limiting del endpoint público de reservas (`api/appointments/route.ts`) y el throttle de intentos de login (`lib/auth.ts`) usan un `Map` **en memoria por pod**. Los comentarios del código asumen "single-pod k3s", pero la infraestructura real declara:

```
infra/k8s/base/deployment.yaml:  replicas: 2   (+ HPA que puede escalar más)
```

Con 2+ réplicas detrás del balanceador, cada pod mantiene su propio contador. Consecuencias:

- El límite efectivo se multiplica por el número de réplicas (5/h por IP se vuelve 10/h, 15/h…), y es inconsistente según a qué pod caiga cada request.
- La protección anti-fuerza-bruta del login se debilita del mismo modo.
- Al escalar con HPA el comportamiento se vuelve no determinista.

Recomendación: mover el contador a un almacén compartido — Redis/Upstash (`@upstash/ratelimit` encaja directo) o, si se quiere evitar una dependencia nueva, una tabla Postgres con ventana deslizante. Es la brecha más importante entre el estado actual y "listo para escalar horizontalmente".

Otros puntos (positivos / menores):

- Creación de cita dentro de `$transaction` con `SlotTakenError` para abortar ante doble reserva — correcto y necesario. Se usa `$transaction` en 8 sitios: buena señal de consistencia.
- `MAX_UPCOMING_PER_PHONE` y `MIN_FILL_MS` como anti-spam/anti-bot — buen criterio de producto.
- `output: 'standalone'`, health check con liveness (sin DB) y readiness (`SELECT 1` sobre el singleton) bien separados para K8s — probes correctas.
- `revalidate`/cache se usa poco (3 sitios). Las páginas públicas (servicios, galería, testimonios, landing stats) son buenos candidatos a caché/ISR para reducir carga de DB en el tráfico anónimo.

### 4. Seguridad — Muy por encima del promedio

- **Headers y CSP explícitos** en `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS a 2 años, `Permissions-Policy` restrictiva, `poweredByHeader: false`, y una CSP detallada con `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action` acotados. `unsafe-eval` solo en dev.
- **Gestión de secretos correcta.** `git ls-files` confirma que solo se versionan `*.example`; `.env`/`.env.local` están en `.gitignore`. Además hay `.gitleaks.toml` para escaneo de secretos.
- **Contraseñas con bcrypt**; `passwordChangedAt` embebido en el JWT invalida tokens antiguos tras un cambio (fuerza re-login en otros dispositivos); `mustChangePassword` obliga a rotación inicial; cuentas desactivadas se expulsan vía callback de sesión.
- **Sesión JWT de 8 h** (jornada laboral) — razonable.
- Subidas a S3 vía presigned URL (el backend no toca el binario) y `img-src`/`connect-src` acotados al bucket.

Puntos a verificar / endurecer (menores):

- `script-src` incluye `'unsafe-inline'` (necesario para GA4 y algunos inline de Next). Es la relajación de CSP más común; si en el futuro se puede migrar a nonces, se cierra ese hueco.
- Confirmar que **todas** las rutas admin invocan `requirePermission`/`getCurrentAdmin` y traducen `null` a 401/403 (test de contrato, ver Acciones).
- El throttle de login comparte el problema multi-pod de la sección 3 — es también una consideración de seguridad, no solo de escalabilidad.

---

## Análisis de trade-offs

El único trade-off estructural relevante es **rate limiting en memoria (simple, cero dependencias) vs. almacén compartido (correcto bajo escala horizontal)**. La solución en memoria fue una decisión válida para un solo pod, pero la infra ya declara 2 réplicas + HPA, así que el supuesto que la justificaba dejó de ser cierto. El costo de migrar a Redis/DB es bajo y elimina un comportamiento no determinista tanto de negocio (límite de reservas) como de seguridad (anti-brute-force). Recomendación clara: hacerlo.

Todo lo demás (ISR/caché en páginas públicas, migración a Auth.js v5, nonces en CSP) son mejoras incrementales sin urgencia y sin riesgo de rediseño.

---

## Consecuencias

- **Se vuelve más fácil:** escalar horizontalmente con confianza una vez el rate limit sea compartido; y auditar cobertura de permisos con el test de contrato.
- **Se vuelve más difícil / costo asumido:** introducir Redis/Upstash agrega una pieza de infraestructura (o una tabla + limpieza) que hay que operar y monitorear.
- **A revisar más adelante:** el fin de vida de NextAuth v4; el uso de `'unsafe-inline'` en CSP; el pineo de versiones muy nuevas de la cadena de test.

---

## Acciones

1. [x] **(Alta)** Reemplazar el rate limiter y el throttle de login en memoria por un almacén compartido.
   **→ Hecho (2026-07-13):** se optó por **tabla Postgres** (sin dependencia nueva). Modelo `RateLimit` (`rate_limits`) + helper `src/lib/rate-limit.ts` con un `INSERT … ON CONFLICT` atómico de ventana fija y *fail-open*. Reemplaza los `Map` en `api/appointments/route.ts` (reservas), `lib/auth.ts` (login) y `api/clients/lookup/route.ts` (autofill).
2. [x] **(Media)** Añadir un test de contrato que recorra las rutas admin y falle si alguna no aplica `requirePermission`/`getCurrentAdmin`.
   **→ Hecho:** `src/app/api/admin-guards.contract.test.ts` — escanea todas las `route.ts` con una allowlist explícita de rutas públicas.
3. [x] **(Media)** Aplicar caché/ISR a las páginas públicas de lectura.
   **→ Hecho (parcial, por diseño):** `landing-stats` pasa a `revalidate = 300` (su GET no depende de sesión). `services`/`gallery`/`testimonials` **deben seguir dinámicas**: su GET ramifica por sesión (`getServerSession`) para mostrar datos de admin en el mismo navegador, así que cachearlas sería incorrecto/inseguro. Cachearlas exigiría separar endpoints público/admin — no se hizo (bajo ROI al tráfico actual).
4. [x] **(Baja)** Fijar versiones exactas de la cadena de test.
   **→ Hecho:** `vite` y `@vitejs/plugin-react` pineados a versión exacta (`vitest` ya lo estaba).
5. [ ] **(Baja / roadmap)** Planificar migración de NextAuth v4 → Auth.js v5. *(Pendiente: v5 en beta; reescribe el core de auth y cada verificación de sesión — esfuerzo dedicado con verificación de login.)*
6. [ ] **(Baja / roadmap)** Evaluar nonces en CSP para eliminar `'unsafe-inline'` en `script-src`. *(Pendiente: requiere mover la CSP a middleware por-request + inyectar el nonce en GA4 y en los scripts de Next, con verificación en navegador.)*

---

*Validación generada con la skill `/architecture` (plugin Engineering). Basada en el estado del repositorio al 2026-07-12. Acciones 1–4 implementadas el 2026-07-13.*
