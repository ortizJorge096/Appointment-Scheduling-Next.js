import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET es requerida'),
  NEXTAUTH_URL: z.string().url().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  SES_FROM_EMAIL: z.string().email().optional(),
  ENABLE_EMAILS: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
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
