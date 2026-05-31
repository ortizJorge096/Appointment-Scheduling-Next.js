#!/usr/bin/env bash
# scripts/k8s-deploy.sh
# Equivalente "break-glass" del job `deploy` de CI/CD. Corre desde una
# shell en el nodo k3s (vía SSM Session Manager) para forzar un apply
# manual sin pasar por GitHub Actions.
#
# Uso:
#   bash scripts/k8s-deploy.sh <overlay> <namespace> <image> <branch>
# Ejemplos:
#   bash scripts/k8s-deploy.sh dev  appointment-scheduling-dev \
#     123456789012.dkr.ecr.us-east-1.amazonaws.com/appointment-scheduling-dev-nextjs:sha-abc1234 develop
#   bash scripts/k8s-deploy.sh prod appointment-scheduling \
#     123456789012.dkr.ecr.us-east-1.amazonaws.com/appointment-scheduling-prod-nextjs:sha-abc1234 main

set -euo pipefail

OVERLAY="${1:-dev}"
NAMESPACE="${2:-appointment-scheduling-dev}"
IMAGE="${3:-}"
BRANCH="${4:-develop}"

if [ -z "$IMAGE" ]; then
  echo "ERROR: image arg requerido"
  echo "Uso: $0 <overlay> <namespace> <image> <branch>"
  exit 1
fi

REPO_DIR="${REPO_DIR:-/opt/app/repo}"

# 1. Sincronizar el repo a la branch correcta.
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "ERROR: el repo no está en $REPO_DIR. Clónalo primero."
  exit 1
fi

cd "$REPO_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 2. Resolver host nip.io para prod (si aplica).
if [ "$OVERLAY" = "prod" ]; then
  TOKEN=$(curl -fsSL -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
  IP=$(curl -fsSL -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/public-ipv4)
  PROD_HOST="appointment-scheduling.${IP//./-}.nip.io"
  echo "── Resolved prod host: $PROD_HOST"
  sed -i "s|appointment-scheduling.example.com|${PROD_HOST}|g" \
    "infra/k8s/overlays/prod/kustomization.yaml" \
    "infra/k8s/overlays/prod/tls-patch.yaml"
fi

# 3. Set image tag + apply.
OVERLAY_DIR="infra/k8s/overlays/${OVERLAY}"
cd "$OVERLAY_DIR"
kustomize edit set image appointment-scheduling="$IMAGE"
cd "$REPO_DIR"

kustomize build "$OVERLAY_DIR" | kubectl apply -f -

# 4. Wait rollout.
kubectl -n "$NAMESPACE" rollout status deployment/appointment-scheduling --timeout=600s

# 5. Audit.
echo "── Pods ──"
kubectl -n "$NAMESPACE" get pods -o wide
echo "── Services / Ingress ──"
kubectl -n "$NAMESPACE" get svc,ingress
echo "── HPA ──"
kubectl -n "$NAMESPACE" get hpa || true
