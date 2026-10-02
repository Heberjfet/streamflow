#!/usr/bin/env bash
# ==============================================================================
# StreamFlow v2 — Script de Instalación Rápida
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")"

chmod +x ./streamflow.sh 2>/dev/null || true

echo "===================================================="
echo "    Instalador Rápido de StreamFlow v2"
echo "===================================================="

./streamflow.sh up "$@"
