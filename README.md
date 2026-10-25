# StreamFlow

**Plataforma de Video Self-Hosted para streaming personal**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

StreamFlow es una plataforma de streaming de video que permite subir, transcodificar y transmitir contenido en HLS adaptativo desde tu propia infraestructura.

## Características

- **Upload directo a S3** — Subida eficiente desde el navegador
- **Transcoding real con FFmpeg** — Conversión a HLS 360p/480p/720p/1080p
- **Thumbnail sprites** — Vista previa en scrubber del reproductor
- **HLS playback adaptativo** — Streaming con HLS.js
- **Job queue** — BullMQ para procesamiento confiable de videos
- **Auth** — JWT (email + contraseña)
- **Catálogos** — Organización de videos con relación muchos-a-muchos
- **Docker ready** — Despliegue simple con Docker Compose
- **Reverse proxy nginx** — Frontend y API bajo el mismo dominio
- **Cloudflare ready** — Soporte para Cloudflare SSL/TLS

## Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| API | Fastify (Node.js, ESM, TypeScript) |
| ORM | Drizzle |
| Database | PostgreSQL 16 |
| Queue | BullMQ + Redis |
| Storage | SeaweedFS (S3-compatible) |
| Transcoding | FFmpeg + fluent-ffmpeg |
| Player | HLS.js |
| Frontend | Next.js 15 |

## Quick Start (Un Solo Comando)

### Prerrequisitos

- Docker & Docker Compose
- Node.js 20 LTS (opcional, solo para desarrollo sin Docker)

### 🚀 Despliegue Inmediato

StreamFlow incluye scripts automatizados que verifican Docker, generan el `.env` con contraseñas criptográficas seguras, compilan las imágenes multi-stage y levantan el stack completo en orden:

**En Linux / macOS:**
```bash
git clone https://github.com/Heberjfet/streamflow.git
cd streamflow
chmod +x ./install.sh
./install.sh
```

**En Windows (PowerShell):**
```powershell
git clone https://github.com/Heberjfet/streamflow.git
cd streamflow
.\streamflow.ps1 up
```

**Con Make:**
```bash
make up
```

Una vez levantado:
| Servicio | URL | Descripción |
|---|---|---|
| **Frontend** | `http://localhost:3000` | Interfaz web Next.js 15 |
| **API** | `http://localhost:3001` | API Fastify + healthcheck |
| **Storage (Filer UI)** | `http://localhost:8888` | Explorador de archivos SeaweedFS |
| **S3 Endpoint** | `http://localhost:9000` | Gateway S3 |

### 🛠️ Comandos de Gestión

Tanto `./streamflow.sh` (Linux/macOS) como `.\streamflow.ps1` (Windows) ofrecen comandos unificados:

```bash
./streamflow.sh up            # Levantar stack local
./streamflow.sh up --prod     # Levantar en producción (con nginx y SSL)
./streamflow.sh down          # Detener servicios
./streamflow.sh logs          # Ver logs en tiempo real
./streamflow.sh logs api      # Logs de un servicio específico
./streamflow.sh ps            # Estado de los contenedores
./streamflow.sh migrate       # Ejecutar migraciones Drizzle
./streamflow.sh reset         # Detener y reiniciar volúmenes (base de datos y S3)
```

### Desarrollo Local (sin Docker)

```bash
# Instalar dependencias
npm install

# Iniciar API (terminal 1)
npm run dev:api

# Iniciar Worker (terminal 2)
npm run dev:worker

# Iniciar Frontend (terminal 3)
npm run dev:frontend
```

## Despliegue en Producción

La configuración de producción usa **nginx como reverse proxy** para servir frontend y API bajo el mismo dominio, con soporte para Cloudflare.

### 1. Configurar dominio y DNS

```
flow.tudominio.com → A → IP_DEL_VPS
```

### 2. Configurar entorno

```bash
cp .env.example .env
```

Variables clave para producción:

```env
JWT_SECRET=genera-un-secreto-fuerte
S3_PUBLIC_URL=https://flow.tudominio.com/s3
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_S3_URL=https://flow.tudominio.com/s3
CORS_ORIGINS=https://flow.tudominio.com,http://flow.tudominio.com
```

### 3. Levantar con Docker

```bash
# Construir y levantar todos los servicios
docker compose --profile production up -d --build
```

### 4. Con Cloudflare (recomendado)

1. Agregá el dominio a Cloudflare
2. SSL/TLS → **Flexible**
3. DNS → Registro A con proxy naranja (proxied)
4. Nginx ya incluye las IPs de Cloudflare para `real_ip`

El proxy S3 (`/s3/`) evita mixed content: los thumbnails y segmentos HLS se sirven por HTTPS a través de nginx.

### 5. Sin Cloudflare (SSL directo)

Descomentá el bloque HTTPS en `docker/nginx.conf`, colocá tus certificados en `./ssl/` y rebuild:

```bash
docker compose --profile production up -d --build nginx
```

## Arquitectura

```
                      ┌──────────────┐
                      │  Cloudflare  │ (opcional)
                      │  (SSL/TLS)   │
                      └──────┬───────┘
                             │
                      ┌──────▼───────┐
                      │    nginx     │
                      │  (reverse    │
                      │   proxy)     │
                      └──┬───────┬───┘
                         │       │
              ┌──────────▼┐  ┌───▼──────────┐
              │  Frontend  │  │  API         │
              │ (Next.js)  │  │  (Fastify)   │
              └────────────┘  └──┬───────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼────┐ ┌────▼────┐ ┌─────▼────┐
              │PostgreSQL│ │  Redis  │ │  Worker  │
              │          │ │(BullMQ) │ │(FFmpeg)  │
              └──────────┘ └─────────┘ └────┬─────┘
                                            │
                                      ┌─────▼────┐
                                      │SeaweedFS │
                                      │   (S3)   │
                                      └──────────┘
```

## Environment Variables

```env
# ──────────────────────────────────
# Database
DATABASE_URL=postgresql://streamflow:streamflow@postgres:5432/streamflow

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=change-this-in-production

# S3 (SeaweedFS)
S3_ENDPOINT=http://s3:8333
S3_BUCKET=streamflow
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# URLs públicas de S3 (proxyadas por nginx /s3/)
S3_PUBLIC_URL=https://flow.tudominio.com/s3
S3_BROWSER_ENDPOINT=https://flow.tudominio.com/s3

# CORS
CORS_ORIGINS=https://flow.tudominio.com,http://flow.tudominio.com

# API
PORT=3001

# Frontend (ruta relativa, mismo dominio vía nginx)
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_S3_URL=https://flow.tudominio.com/s3
```

## API Endpoints

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/v1/auth/register` | Registro de usuario |
| POST | `/v1/auth/login` | Login con JWT |
| GET | `/v1/auth/me` | Usuario actual |

### Assets (Videos)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/assets` | Listar videos |
| POST | `/v1/assets` | Crear asset |
| GET | `/v1/assets/:id` | Detalle de asset |
| PUT | `/v1/assets/:id` | Actualizar asset |
| DELETE | `/v1/assets/:id` | Eliminar asset |
| POST | `/v1/assets/:id/upload` | Subir archivo (multipart) |
| POST | `/v1/assets/:id/process` | Iniciar transcoding |

### Catálogos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/categories` | Listar catálogos |
| POST | `/v1/categories` | Crear catálogo |
| PUT | `/v1/categories/:id` | Actualizar catálogo |
| DELETE | `/v1/categories/:id` | Eliminar catálogo |

### Playback
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/playback/:playbackId` | Obtener URL del HLS manifest |
| POST | `/v1/playback/:playbackId/events` | Enviar eventos de reproducción |

## Comandos Útiles

```bash
npm run dev:api        # API en :3001
npm run dev:worker     # Worker (transcoding)
npm run dev:frontend   # Frontend en :3000

npm run build:api      # Compilar API
npm run build:worker   # Compilar worker
npm run build:frontend # Build Next.js

npm run db:generate    # Generar migraciones
npm run db:migrate     # Aplicar migraciones
npm run db:push        # Push schema (dev)

docker compose --profile production up -d  # Producción con nginx
```

## Upload de Video

```bash
# 1. Crear asset
curl -X POST http://localhost:3001/v1/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Mi Video"}'

# 2. Subir archivo (multipart, en streaming hacia S3)
curl -X POST http://localhost:3001/v1/assets/ASSET_ID/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@video.mp4"

# 3. Iniciar transcoding
curl -X POST http://localhost:3001/v1/assets/ASSET_ID/process \
  -H "Authorization: Bearer $TOKEN"
```

## Licencia

MIT — Libre para uso personal y comercial.
