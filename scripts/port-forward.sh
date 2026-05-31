#!/usr/bin/env bash
# scripts/port-forward.sh
# Expone el Service contra localhost cuando no hay ingress disponible.
#
# Defaults:
#   NAMESPACE=appointment-scheduling-local
#   LOCAL_PORT=8080
#
# Uso:
#   bash scripts/port-forward.sh
#   NAMESPACE=appointment-scheduling-dev LOCAL_PORT=3001 bash scripts/port-forward.sh

set -euo pipefail

NAMESPACE="${NAMESPACE:-appointment-scheduling-local}"
LOCAL_PORT="${LOCAL_PORT:-8080}"

echo "── Forwarding svc/appointment-scheduling :80 → localhost:${LOCAL_PORT} ──"
echo "   (Ctrl+C para detener)"
kubectl -n "$NAMESPACE" port-forward svc/appointment-scheduling "${LOCAL_PORT}:80"
