# Dockerfile
# Multi-stage build — minimal final image

# ── Stage 1: dependencies ──────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies required by Prisma
RUN apk add --no-cache libc6-compat openssl

COPY .npmrc package.json package-lock.json* ./
RUN npm install

# ── Stage 2: build ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Production build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner (final image) ─────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

# ── Next.js standalone output ──
# Includes server.js and ONLY the runtime dependencies the app imports
# (traced by Next.js). Avoids copying the full node_modules with devDeps.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
# public/ is not included in standalone — copy it explicitly
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# .next/cache is not part of the standalone output (it doesn't exist yet),
# but Next.js writes to it at runtime (e.g. the image optimizer cache).
# Create it now, owned by the runtime user, or `mkdir` fails with EACCES.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

# ── Prisma ──
# Schema + migrations, plus the CLI and engines the init-container
# needs for `prisma migrate deploy`. The standalone output does not trace the
# CLI (it is a devDependency) and may not include the query engine binary,
# so they are explicitly overlayed onto the traced node_modules.
COPY --from=builder /app/prisma                   ./prisma
COPY --from=builder /app/node_modules/.prisma     ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma     ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma      ./node_modules/prisma
# Note: the init-container invokes the CLI via `node node_modules/prisma/build/index.js`
# (see k8s deployment), so we do NOT rely on the .bin/prisma symlink — Docker would
# flatten it into a file and break its `require('../package.json')`.

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
