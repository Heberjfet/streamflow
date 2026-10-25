#!/usr/bin/env bash
# ==============================================================================
# StreamFlow — Script de Instalación Rápida
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")"

chmod +x ./streamflow.sh 2>/dev/null || true

echo "===================================================="
echo "    Instalador Rápido de StreamFlow"
echo "===================================================="

./streamflow.sh up "$@"
