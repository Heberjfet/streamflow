# ── StreamFlow API (Fastify) — Multi-stage Production Dockerfile ─────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY worker/package*.json ./worker/
COPY frontend/package*.json ./frontend/

RUN npm ci

COPY apps/api ./apps/api
COPY tsconfig*.json ./

RUN npm run build:api
RUN npm prune --omit=dev

# ── Runner de producción ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/drizzle ./apps/api/drizzle
COPY docker/entrypoint.sh /app/docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["node", "apps/api/dist/app.js"]