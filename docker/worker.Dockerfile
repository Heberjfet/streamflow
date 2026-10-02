# ── StreamFlow Worker (BullMQ + FFmpeg) — Multi-stage Production Dockerfile ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY worker/package*.json ./worker/
COPY frontend/package*.json ./frontend/

RUN npm ci

COPY worker ./worker
COPY tsconfig*.json ./

RUN npm run build:worker
RUN npm prune --omit=dev

# ── Runner de producción ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache ffmpeg

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/worker/package.json ./worker/package.json
COPY --from=builder /app/worker/dist ./worker/dist

CMD ["node", "worker/dist/index.js"]