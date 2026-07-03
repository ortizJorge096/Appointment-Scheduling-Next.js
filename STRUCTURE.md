# Estructura del proyecto — valentinajimenez

Ver también [`CONTRIBUTING.md`](./CONTRIBUTING.md) para las reglas de código
(dónde va cada cosa, convenciones, patrones prohibidos).

## Stack

- **Framework**: Next.js 15.3.3 (App Router) + TypeScript 5.4
- **Estilos**: Tailwind CSS 3.4
- **Base de datos**: PostgreSQL (AWS RDS)
- **ORM**: Prisma 5.14
- **Auth**: NextAuth 4.24
- **Email**: AWS SES (`@aws-sdk/client-ses`)
- **Imágenes**: AWS S3 (`@aws-sdk/client-s3`)
- **Analítica**: Google Analytics 4 (solo páginas públicas)
- **Zona horaria**: `America/Bogota` (`date-fns-tz`)
- **Tests**: Vitest (unit/integration) + Playwright (e2e)
- **Deploy**: AWS (Terraform + k3s/Kubernetes vía CI/CD) — ver [`infra/README.md`](./infra/README.md)

---

## Árbol de carpetas

```
appointment-scheduling-nextjs/
├── prisma/
│   └── schema.prisma          # 18 modelos: User, Client, Category, Service,
│                               # Professional, Appointment (+ AppointmentService,
│                               # AppointmentExtra), Schedule, BlockedDate,
│                               # Expense, GalleryImage, Testimonial, AuditLog,
│                               # VipDiscountConfig/Tier, BookingSettings, LandingStats
│
├── src/
│   ├── app/
│   │   ├── layout.tsx / page.tsx / globals.css
│   │   ├── agendar/            # Reserva pública
│   │   ├── confirmacion/       # Confirmación post-reserva
│   │   ├── cancelar/           # Cancelación pública vía token
│   │   │
│   │   ├── admin/
│   │   │   ├── login/
│   │   │   └── (protected)/    # Layout con sidebar + auth check
│   │   │       ├── page.tsx           # Dashboard
│   │   │       ├── citas/[id]/        # Lista y detalle de citas
│   │   │       ├── clientes/[id]/     # Directorio y ficha de cliente
│   │   │       ├── servicios/         # Catálogo (servicios + categorías)
│   │   │       ├── profesionales/     # Profesionales del catálogo
│   │   │       ├── horarios/          # Disponibilidad y fechas bloqueadas
│   │   │       ├── contabilidad/      # Ingresos y gastos
│   │   │       ├── galeria/           # Galería de imágenes (S3)
│   │   │       ├── testimonios/       # Moderación de testimonios
│   │   │       ├── usuarios/          # Gestión de admins (SUPER_ADMIN)
│   │   │       ├── auditoria/         # Log de auditoría
│   │   │       ├── sitio/             # Configuración de landing/VIP/reservas
│   │   │       ├── perfil/            # Perfil del admin logueado
│   │   │       └── no-autorizado/     # Página de acceso denegado
│   │   │
│   │   └── api/                # Un route.ts por recurso, ver CONTRIBUTING.md §5
│   │       ├── auth/[...nextauth]/
│   │       ├── appointments/ (+ [id]/cancel, manual)
│   │       ├── availability/ (+ next, range, today)
│   │       ├── services/ [id]/ · categories/ [id]/ · professionals/ [id]/
│   │       ├── schedules/ (+ blocked/[id])
│   │       ├── clients/ [id]/ · testimonials/ [id]/ (+ upload-url)
│   │       ├── gallery/ [id]/ (+ upload-url)
│   │       ├── expenses/ [id]/ · accounting/
│   │       ├── users/ [id]/ · account/password/
│   │       ├── audit/ (+ export)
│   │       ├── vip-config/ · booking-settings/ · config/
│   │       ├── landing-stats/ · health/
│   │
│   ├── components/
│   │   ├── ui/                 # Card, ConfirmDialog, Toast
│   │   ├── public/              # Navbar, Hero(+Carousel/SocialProof), ServicesGrid,
│   │   │                        # AvailabilityBand, BookingForm, DateTimePicker,
│   │   │                        # Testimonios, Galeria, FAQ, Footer(+variantes), etc.
│   │   ├── admin/                # Sidebar, ManualAppointmentModal, DescuentoEditor,
│   │   │                        # AdicionalesEditor, ClientSearchInput, IconPicker,
│   │   │                        # CategoriesManager, Pagination, VipDiscountConfigCard,
│   │   │                        # BookingSettingsCard, usePermissionGuard.ts
│   │   └── GoogleAnalytics.tsx
│   │
│   ├── lib/                     # Helpers de negocio/infraestructura, uno por responsabilidad:
│   │   ├── prisma.ts            # Singleton de PrismaClient
│   │   ├── auth.ts               # Config de NextAuth
│   │   ├── authz.ts              # getCurrentAdmin() / requirePermission()
│   │   ├── permissions.ts        # Matriz de roles y permisos
│   │   ├── audit.ts              # audit() — log de auditoría
│   │   ├── validations.ts        # Todos los schemas Zod
│   │   ├── availability.ts       # Cálculo de slots disponibles
│   │   ├── cancellation.ts       # Lógica de cancelación por token
│   │   ├── calendar.ts / bookingSettings.ts / vip.ts / discount.ts
│   │   ├── email.ts              # Envío de emails (SES)
│   │   ├── s3.ts                 # Subida/borrado de imágenes
│   │   ├── db-error.ts           # isDbUnavailable() y manejo de errores Prisma
│   │   ├── analytics.ts / landingStats.ts / hero.ts / clients.ts
│   │   ├── appointmentList.ts / appointmentStatus.ts
│   │   ├── config.ts / env.ts / utils.ts
│   │
│   ├── types/
│   │   └── index.ts              # Tipos TypeScript del dominio
│   │
│   └── hooks/
│       ├── useAvailability.ts    # Slots libres (público)
│       └── useAppointments.ts    # Gestión de citas (admin)
│
├── e2e/                          # Playwright — 3 flujos: agendar, cancelar, admin
├── scripts/                      # Cron de recordatorios/follow-ups, seeds, deploy k8s
├── infra/                        # Terraform + Kubernetes — ver infra/README.md
├── .env.local / .env.example
├── next.config.ts / tailwind.config.ts / tsconfig.json
├── vitest.config.ts / playwright.config.ts
├── eslint.config.mjs / .prettierrc.yaml
└── package.json
```

---

## Variables de entorno (`.env.local`)

Plantilla real en [`.env.example`](./.env.example). Resumen:

```bash
# Base de datos (AWS RDS PostgreSQL)
DATABASE_URL="postgresql://usuario:contraseña@tu-endpoint.rds.amazonaws.com:5432/valentinajimenez"

# NextAuth
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"   # en prod: https://tudominio.com

# AWS SES (emails)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
SES_FROM_EMAIL="noreply@tudominio.com"
ENABLE_EMAILS=false                     # apagar envíos en desarrollo

# AWS S3 (galería) — en EC2/k8s con Instance Profile no hace falta access key
AWS_S3_BUCKET="appointment-scheduling-assets"
AWS_S3_PUBLIC_BASE_URL=""               # opcional, CDN

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_GA_MEASUREMENT_ID=""        # vacío = analytics desactivado
NEXT_PUBLIC_WHATSAPP_NUMBER="573001790511"
NEXT_PUBLIC_WHATSAPP_MESSAGE="¡Hola! Vengo de su sitio web..."

# Solo para Docker Compose local
POSTGRES_DB=valentinajimenez
POSTGRES_USER=valentinajimenez
POSTGRES_PASSWORD=devpassword
```

No existen `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` — los admins se crean desde
`/admin/usuarios` (requiere permiso `admins:gestionar`) o vía `prisma/seed.ts`.

---

## Comandos de inicio

```bash
npm install                    # instalar dependencias
npx prisma migrate dev         # aplicar migraciones a la BD local
npm run db:seed                # poblar con datos de ejemplo
npm run dev                    # desarrollo local (http://localhost:3000)

npm run lint                   # ESLint
npm run format:fix             # Prettier
npm run test                   # Vitest (unit/integration)
npm run test:e2e               # Playwright (build + tests e2e)

npm run build && npm start     # build de producción
```

Ver `package.json` para el resto de scripts (`reminders`, `follow-ups`,
`fill-day`, `clear-demo`, `db:studio`, etc.).

---

## Rutas de la aplicación

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | Landing page | Público |
| `/agendar` | Formulario de agendamiento | Público |
| `/confirmacion?id=xx` | Confirmación post-cita | Público |
| `/cancelar?id=xx&token=yy` | Cancelación vía enlace del email | Público |
| `/admin/login` | Login de administración | Público |
| `/admin` | Dashboard | Admin (`metricas:ver`) |
| `/admin/citas`, `/admin/citas/[id]` | Gestión de citas | Admin (`citas:*`) |
| `/admin/clientes`, `/admin/clientes/[id]` | Directorio de clientes | Admin (`clientes:*`) |
| `/admin/servicios` | Catálogo de servicios y categorías | Admin (`servicios:*`) |
| `/admin/profesionales` | Profesionales | Admin (`servicios:*`) |
| `/admin/horarios` | Horarios y fechas bloqueadas | Admin (`horarios:*`) |
| `/admin/contabilidad` | Ingresos y gastos | Admin (`contabilidad:*`) |
| `/admin/galeria` | Galería de imágenes | Admin (`galeria:*`) |
| `/admin/testimonios` | Moderación de testimonios | Admin (`testimonios:*`) |
| `/admin/usuarios` | Gestión de administradores | `SUPER_ADMIN` (`admins:gestionar`) |
| `/admin/auditoria` | Log de auditoría | Admin (`auditoria:ver`) |
| `/admin/sitio` | Configuración VIP, landing, reservas | Admin (`configuracion:*`) |
| `/admin/no-autorizado` | Acceso denegado | Cualquier sesión |

Matriz completa de roles/permisos en [`src/lib/permissions.ts`](./src/lib/permissions.ts).

---

## Infraestructura y deploy

La infraestructura vive en `infra/` (Terraform + manifiestos k8s) y el deploy
real es automático vía GitHub Actions → ECR → k3s sobre EC2. Ver
[`infra/README.md`](./infra/README.md) para el detalle completo (dev/prod,
CI/CD, ADRs, costos). El `docker compose up` de [`README.md`](./README.md) es
**solo** para desarrollo local.
