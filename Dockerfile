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

# ── Output standalone de Next ──
# Incluye server.js y SOLO las dependencias de runtime que la app importa
# (trazadas por Next). Evita copiar node_modules completo con devDeps.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
# public/ no está incluido en standalone — copiarlo explícitamente
COPY --from=builder /app/public           ./public

# ── Prisma ──
# Esquema + migraciones, más el CLI y los engines que el init-container
# necesita para `prisma migrate deploy`. El output standalone no traza el CLI
# (es devDependency) ni siempre incluye el binario del query engine, así que
# se superponen explícitamente sobre el node_modules trazado.
COPY --from=builder /app/prisma                   ./prisma
COPY --from=builder /app/node_modules/.prisma     ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma     ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma      ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma* ./node_modules/.bin/

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
