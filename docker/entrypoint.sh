#!/bin/sh
set -e

echo "==> [StreamFlow API] Aplicando migraciones de base de datos..."
node /app/apps/api/dist/db/migrate.js

echo "==> [StreamFlow API] Iniciando servidor..."
exec "$@"
