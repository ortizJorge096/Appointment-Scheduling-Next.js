import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET es requerida'),
  NEXTAUTH_URL: z.string().url().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  SES_FROM_EMAIL: z.string().email().optional(),  // legacy fallback for the "from" address
  ENABLE_EMAILS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  // Shared secret the scheduler (k8s CronJob) sends to POST /api/cron. Unset =
  // the cron endpoint stays locked (401), so it fails safe.
  CRON_SECRET: z.string().optional(),
}).superRefine((e, ctx) => {
  // Conditional requirements — a variable can be optional in isolation but
  // required once a feature that depends on it is turned on.
  if (e.ENABLE_EMAILS === 'true' && !e.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY es requerida cuando ENABLE_EMAILS=true',
    })
  }
  // Google Calendar is OPTIONAL and all-or-nothing. A partial config disables
  // the integration with a warning instead of failing the whole boot — the app
  // already guards every calendar call at runtime (see lib/calendar.ts). This
  // keeps an infra drift (e.g. a Secret missing GOOGLE_PRIVATE_KEY after an
  // instance replacement) from taking the entire app down.
  const g = [e.GOOGLE_CLIENT_EMAIL, e.GOOGLE_PRIVATE_KEY, e.GOOGLE_CALENDAR_ID]
  if (g.some(Boolean) && !g.every(Boolean)) {
    console.warn(
      '⚠️  Google Calendar parcialmente configurado (falta GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY o GOOGLE_CALENDAR_ID) — integración deshabilitada.',
    )
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas o faltantes:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Configuración de entorno inválida')
  }
}

export const env = parsed.data ?? ({} as Record<string, unknown>)
