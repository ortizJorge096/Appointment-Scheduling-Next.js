# Estructura del Proyecto — valentinajimenez

## Stack
- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilos**: Tailwind CSS
- **Base de datos**: PostgreSQL (AWS RDS)
- **ORM**: Prisma
- **Auth**: NextAuth.js
- **Email**: AWS SES (@aws-sdk/client-ses)
- **Zona horaria**: America/Bogota (date-fns-tz)
- **Deploy**: AWS EC2 + RDS + Route53

---

## Árbol de carpetas

```
valentinajimenez/
├── prisma/
│   ├── schema.prisma          # Modelos de datos
│   └── seed.ts                # Datos de ejemplo
│
├── src/
│   ├── app/                   # App Router de Next.js
│   │   ├── layout.tsx         # Layout raíz (fuentes, metadata)
│   │   ├── page.tsx           # Landing page pública
│   │   ├── globals.css        # Estilos globales + variables CSS
│   │   │
│   │   ├── agendar/
│   │   │   └── page.tsx       # Página de agendamiento público
│   │   │
│   │   ├── confirmacion/
│   │   │   └── page.tsx       # Confirmación post-agendamiento
│   │   │
│   │   ├── cancelar/          # Cancelación pública vía token del email
│   │   │   ├── page.tsx
│   │   │   └── CancelarClient.tsx
│   │   │
│   │   ├── admin/             # Panel de administración (protegido)
│   │   │   ├── layout.tsx     # Layout del admin (sidebar, auth check)
│   │   │   ├── page.tsx       # Dashboard principal
│   │   │   ├── citas/
│   │   │   │   ├── page.tsx   # Lista de citas
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # Detalle de cita
│   │   │   ├── servicios/
│   │   │   │   └── page.tsx   # CRUD de servicios
│   │   │   └── horarios/
│   │   │       └── page.tsx   # Gestión de disponibilidad
│   │   │
│   │   └── api/               # API Routes
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts   # NextAuth handler
│   │       ├── appointments/
│   │       │   ├── route.ts       # GET (listar) / POST (crear cita)
│   │       │   └── [id]/
│   │       │       └── route.ts   # GET / PATCH / DELETE por ID
│   │       ├── services/
│   │       │   ├── route.ts       # GET / POST servicios
│   │       │   └── [id]/
│   │       │       └── route.ts   # PATCH / DELETE servicio
│   │       ├── availability/
│   │       │   └── route.ts       # GET slots disponibles por fecha+servicio
│   │       └── schedules/
│   │           └── route.ts       # GET / POST / PATCH horarios
│   │
│   ├── components/
│   │   ├── ui/                    # Componentes base reutilizables
│   │   │   ├── Card.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   │
│   │   ├── public/                # Componentes del sitio público
│   │   │   ├── Navbar.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── ServicesGrid.tsx
│   │   │   ├── Testimonios.tsx
│   │   │   ├── BookingSection.tsx
│   │   │   ├── BookingForm.tsx    # Formulario principal con validación
│   │   │   ├── DateTimePicker.tsx # Selector de fecha/hora con disponibilidad real
│   │   │   └── Footer.tsx
│   │   │
│   │   └── admin/                 # Componentes del panel admin
│   │       ├── Sidebar.tsx
│   │       ├── Pagination.tsx
│   │       ├── ManualAppointmentModal.tsx
│   │       └── VipDiscountConfigCard.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts             # Singleton de PrismaClient
│   │   ├── auth.ts               # Configuración de NextAuth
│   │   ├── email.ts              # Funciones de envío de email (SES)
│   │   ├── availability.ts       # Lógica de generación de slots
│   │   ├── validations.ts        # Schemas de Zod para validación
│   │   └── utils.ts              # Helpers generales
│   │
│   ├── types/
│   │   └── index.ts              # Tipos TypeScript del dominio
│   │
│   └── hooks/
│       ├── useAvailability.ts    # Hook para consultar slots libres
│       └── useAppointments.ts    # Hook para gestión de citas (admin)
│
│   (Las plantillas de email viven en código, en src/lib/email.ts)
│
├── scripts/
│   └── send-reminders.ts         # Script cron para recordatorios 24h antes
│
├── .env.local                    # Variables de entorno (ver sección abajo)
├── .env.example                  # Plantilla de variables (commitear esto)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Variables de entorno (.env.local)

```bash
# Base de datos (AWS RDS)
DATABASE_URL="postgresql://user:password@your-rds-endpoint:5432/valentinajimenez"

# NextAuth
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="https://tudominio.com"

# Admin inicial
ADMIN_EMAIL="admin@valentinajimenez.com"
ADMIN_PASSWORD_HASH="bcrypt-hash-aqui"

# AWS SES (email)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
SES_FROM_EMAIL="noreply@tudominio.com"

# AWS S3 (imágenes)
AWS_S3_BUCKET="valentinajimenez-assets"

# App
NEXT_PUBLIC_APP_NAME="valentinajimenez"
NEXT_PUBLIC_APP_URL="https://tudominio.com"
```

---

## Comandos de inicio

```bash
# Instalar dependencias
npm install

# Aplicar migraciones a la BD
npx prisma migrate dev --name init

# Poblar con datos de ejemplo
npx ts-node prisma/seed.ts

# Desarrollo local
npm run dev

# Build para producción
npm run build && npm start
```

---

## Dependencias principales

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@prisma/client": "^5.0.0",
    "next-auth": "^4.24.0",
    "@aws-sdk/client-ses": "^3.0.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18.0.0",
    "@types/node": "^20.0.0",
    "@types/bcryptjs": "^2.4.0"
  }
}
```
