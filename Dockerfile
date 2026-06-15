# Dockerfile
# Multi-stage build — imagen final liviana

# ── Etapa 1: dependencias ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Instalar dependencias del sistema necesarias para Prisma
RUN apk add --no-cache libc6-compat openssl

COPY .npmrc package.json package-lock.json* ./
RUN npm ci

# ── Etapa 2: build ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate

# Build de producción
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Etapa 3: runner (imagen final) ─────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

# Copiar solo lo necesario para producción
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/package.json    ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static    ./.next/static
# public/ no esta incluido en standalone — copiarlo explicitamente
COPY --from=builder /app/public          ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
