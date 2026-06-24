#!/usr/bin/env bash
# scripts/local-deploy.sh
# Build + apply del overlay `local` contra minikube o docker-desktop.
# Útil para validar manifiestos sin tocar AWS.
#
# Pre-requisitos:
#   - minikube o docker-desktop con K8s habilitado
#   - kustomize, kubectl, docker en PATH
#   - Postgres corriendo en el host (docker compose up -d db)
#
# Uso:
#   bash scripts/local-deploy.sh

set -euo pipefail

TAG="${TAG:-dev}"
IMAGE="appointment-scheduling:${TAG}"

# Si estamos en minikube, usar su docker daemon.
if command -v minikube >/dev/null 2>&1 && minikube status >/dev/null 2>&1; then
  echo "── Using minikube docker daemon ──"
  eval "$(minikube docker-env)"
fi

echo "── Building image ${IMAGE} ──"
docker build -t "$IMAGE" .

echo "── Applying overlay local ──"
# Prefer standalone kustomize (honors a custom TAG); otherwise fall back to the
# kustomize built into kubectl. The local overlay already pins the image tag to
# ':dev' (images.newTag), so the fallback works without standalone kustomize.
if command -v kustomize >/dev/null 2>&1; then
  ( cd infra/k8s/overlays/local && kustomize edit set image appointment-scheduling="$IMAGE" )
  kustomize build infra/k8s/overlays/local | kubectl apply -f -
else
  echo "  (kustomize not found — using built-in 'kubectl apply -k'; image pinned to ':dev')"
  kubectl apply -k infra/k8s/overlays/local
fi

echo "── Rollout status ──"
kubectl -n appointment-scheduling-local rollout status deployment/appointment-scheduling --timeout=300s

echo "── Pods ──"
kubectl -n appointment-scheduling-local get pods -o wide

cat <<EOF

✓ Listo. Para acceder:
  - Si usas minikube con addon ingress:
      echo "\$(minikube ip) appointment-scheduling.local" | sudo tee -a /etc/hosts
      curl http://appointment-scheduling.local/api/health
  - Si usas docker-desktop o no quieres tocar /etc/hosts:
      bash scripts/port-forward.sh

EOF
