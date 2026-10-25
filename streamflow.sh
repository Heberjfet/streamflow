#!/usr/bin/env bash
# ==============================================================================
# StreamFlow — Script de Gestión y Despliegue en Un Solo Comando
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")"

# Colores para salida de terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

generate_secret() {
  local length="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$((length / 2))"
  else
    head /dev/urandom | tr -dc A-Za-z0-9 | head -c "$length"
  fi
}

init_env() {
  if [ -f .env ]; then
    echo -e "${YELLOW}ℹ️  El archivo .env ya existe. No se sobreescribirá.${NC}"
    return 0
  fi

  echo -e "${BLUE}==> Generando configuración inicial con secretos criptográficos...${NC}"

  if [ ! -f .env.example ]; then
    echo -e "${RED}❌ Error: No se encontró .env.example para copiar.${NC}"
    exit 1
  fi

  cp .env.example .env

  # Generar secretos
  PG_PASS=$(generate_secret 32)
  JWT_SEC=$(generate_secret 64)
  S3_SEC=$(generate_secret 32)

  # Reemplazar en .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/POSTGRES_PASSWORD=streamflow/POSTGRES_PASSWORD=${PG_PASS}/g" .env
    sed -i '' "s/:streamflow@postgres:5432/:${PG_PASS}@postgres:5432/g" .env
    sed -i '' "s/JWT_SECRET=change-this-in-production/JWT_SECRET=${JWT_SEC}/g" .env
    sed -i '' "s/S3_SECRET_KEY=minioadmin/S3_SECRET_KEY=${S3_SEC}/g" .env
  else
    sed -i "s/POSTGRES_PASSWORD=streamflow/POSTGRES_PASSWORD=${PG_PASS}/g" .env
    sed -i "s/:streamflow@postgres:5432/:${PG_PASS}@postgres:5432/g" .env
    sed -i "s/JWT_SECRET=change-this-in-production/JWT_SECRET=${JWT_SEC}/g" .env
    sed -i "s/S3_SECRET_KEY=minioadmin/S3_SECRET_KEY=${S3_SEC}/g" .env
  fi

  # Sincronizar credenciales de SeaweedFS en docker/seaweedfs-s3.json
  if [ -f docker/seaweedfs-s3.json ]; then
    cat <<EOF > docker/seaweedfs-s3.json
{
  "identities": [
    {
      "name": "streamflow",
      "credentials": [
        {
          "accessKey": "minioadmin",
          "secretKey": "${S3_SEC}"
        }
      ],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
EOF
  fi

  echo -e "${GREEN}✅ Archivo .env generado exitosamente con secretos seguros.${NC}"
  echo -e "${GREEN}✅ docker/seaweedfs-s3.json sincronizado con las credenciales S3.${NC}"
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está instalado en este sistema.${NC}"
    echo "Instálalo desde: https://docs.docker.com/get-docker/"
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose no está disponible.${NC}"
    exit 1
  fi
}

cmd_up() {
  check_docker
  init_env

  local profile=""
  for arg in "$@"; do
    if [ "$arg" == "--prod" ] || [ "$arg" == "--production" ]; then
      profile="--profile production"
    fi
  done

  echo -e "${BLUE}==> Construyendo y levantando servicios de StreamFlow...${NC}"
  # shellcheck disable=SC2086
  docker compose $profile up -d --build

  echo -e "${GREEN}====================================================${NC}"
  echo -e "${GREEN}🚀 StreamFlow está levantado y en ejecución.${NC}"
  echo -e "${GREEN}====================================================${NC}"
  echo -e "  🌐 Frontend:  ${BLUE}http://localhost:3000${NC}"
  echo -e "  🔌 API:       ${BLUE}http://localhost:3001${NC}"
  echo -e "  📦 SeaweedFS: ${BLUE}http://localhost:8888 (Filer UI)${NC}"
  if [ -n "$profile" ]; then
    echo -e "  🛡️  Nginx:     ${BLUE}http://localhost (o tu dominio)${NC}"
  fi
  echo ""
  echo "Para ver logs en vivo: ./streamflow.sh logs"
}

cmd_down() {
  check_docker
  echo -e "${YELLOW}==> Deteniendo servicios de StreamFlow...${NC}"
  docker compose --profile production down
  echo -e "${GREEN}✅ Todos los servicios han sido detenidos.${NC}"
}

cmd_logs() {
  check_docker
  docker compose logs -f "$@"
}

cmd_ps() {
  check_docker
  docker compose ps
}

cmd_migrate() {
  check_docker
  echo -e "${BLUE}==> Ejecutando migraciones de base de datos...${NC}"
  docker compose exec api node apps/api/dist/db/migrate.js
  echo -e "${GREEN}✅ Migraciones completadas.${NC}"
}

cmd_reset() {
  check_docker
  local force=false
  for arg in "$@"; do
    if [ "$arg" == "--force" ] || [ "$arg" == "-f" ]; then
      force=true
    fi
  done

  if [ "$force" = false ]; then
    echo -e "${RED}⚠️  ATENCIÓN: Esto eliminará todos los volúmenes (base de datos y videos en S3).${NC}"
    read -r -p "¿Estás seguro de que deseas continuar? [s/N] " confirm
    if [[ ! "$confirm" =~ ^[sSyY]$ ]]; then
      echo "Operación cancelada."
      exit 0
    fi
  fi

  echo -e "${YELLOW}==> Eliminando contenedores y volúmenes persistentes...${NC}"
  docker compose --profile production down -v
  echo -e "${GREEN}✅ Entorno reiniciado desde cero.${NC}"
}

# Subcomandos
COMMAND="${1:-up}"
shift || true

case "$COMMAND" in
  init)
    init_env
    ;;
  up|start)
    cmd_up "$@"
    ;;
  down|stop)
    cmd_down
    ;;
  logs)
    cmd_logs "$@"
    ;;
  ps|status)
    cmd_ps
    ;;
  migrate)
    cmd_migrate
    ;;
  reset)
    cmd_reset "$@"
    ;;
  help|--help|-h)
    echo "Uso: ./streamflow.sh [COMANDO] [OPCIONES]"
    echo ""
    echo "Comandos disponibles:"
    echo "  up [--prod]     Inicializa .env si falta, compila y arranca los contenedores"
    echo "  down            Detiene todos los contenedores"
    echo "  logs [servicio] Muestra los logs en tiempo real"
    echo "  ps              Muestra el estado de los servicios"
    echo "  migrate         Ejecuta manualmente las migraciones Drizzle"
    echo "  reset [--force] Detiene y borra volúmenes (DB y S3)"
    echo "  init            Genera el archivo .env inicial con contraseñas seguras"
    ;;
  *)
    echo -e "${RED}Comando desconocido: $COMMAND${NC}"
    echo "Usa: ./streamflow.sh help"
    exit 1
    ;;
esac
