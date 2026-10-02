# ── StreamFlow Frontend (Next.js 15 Standalone) — Multi-stage Dockerfile ────
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_S3_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_S3_URL=$NEXT_PUBLIC_S3_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY worker/package*.json ./worker/
COPY frontend/package*.json ./frontend/

RUN npm ci

COPY frontend ./frontend
COPY tsconfig*.json ./

RUN npm run build:frontend

# ── Runner de producción ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "frontend/server.js"]