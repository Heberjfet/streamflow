#!/bin/sh
set -e

echo "Aplicando esquema de base de datos..."
cd /app/apps/api && npx drizzle-kit push --force

echo "Iniciando API..."
exec npx tsx src/app.ts
