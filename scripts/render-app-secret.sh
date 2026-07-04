#!/usr/bin/env bash
# scripts/render-app-secret.sh
# Single source of truth for the app's Kubernetes Secret.
#
# Both the EC2 user-data (first boot / instance replacement / spot recovery) and
# the CI/CD deploy job call this, so the two paths can NEVER drift again on which
# keys the Secret holds. It writes ONLY genuinely-sensitive values; everything
# non-secret (SES_FROM_EMAIL, ENABLE_EMAILS, AWS_*, NEXTAUTH_URL and the two
# public GOOGLE_* ids) lives in the ConfigMap via the kustomize overlay.
#
# Usage:
#   render-app-secret.sh <namespace> <db_url_ssm> <nextauth_ssm> <google_key_ssm> [region]
#
# kubectl uses the ambient context: KUBECONFIG in user-data, ~/.kube/config on
# the self-hosted runner.
set -euo pipefail

NS="${1:?namespace required}"
DB_URL_SSM="${2:?db url SSM parameter name required}"
NEXTAUTH_SSM="${3:?nextauth SSM parameter name required}"
GOOGLE_KEY_SSM="${4:?google key SSM parameter name required}"
REGION="${5:-us-east-1}"

ssm() { aws ssm get-parameter --region "$REGION" --name "$1" --with-decryption --query 'Parameter.Value' --output text; }

DATABASE_URL="$(ssm "$DB_URL_SSM")"
NEXTAUTH_SECRET="$(ssm "$NEXTAUTH_SSM")"
# The Google key may legitimately be unset/placeholder — tolerate a read failure.
GOOGLE_PRIVATE_KEY="$(ssm "$GOOGLE_KEY_SSM" 2>/dev/null || true)"

if [ -z "$DATABASE_URL" ] || [ -z "$NEXTAUTH_SECRET" ]; then
  echo "ERROR: missing required SSM secrets ($DB_URL_SSM / $NEXTAUTH_SSM)" >&2
  exit 1
fi

# Always-present secret keys.
args=(
  --from-literal=DATABASE_URL="$DATABASE_URL"
  --from-literal=NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
)

# Include GOOGLE_PRIVATE_KEY only when it's a real value. If it's empty or still
# the Terraform placeholder, leave it out so the integration stays cleanly
# disabled (env.ts degrades gracefully) instead of half-configured — the same
# partial-trio state that used to crash the boot.
case "$GOOGLE_PRIVATE_KEY" in
  "" | PLACEHOLDER* | None)
    echo "note: Google private key not set in SSM ($GOOGLE_KEY_SSM) — Calendar stays disabled" >&2
    ;;
  *)
    args+=(--from-literal=GOOGLE_PRIVATE_KEY="$GOOGLE_PRIVATE_KEY")
    ;;
esac

kubectl -n "$NS" create secret generic appointment-scheduling-secret \
  "${args[@]}" \
  --dry-run=client -o yaml | kubectl -n "$NS" apply -f -

echo "── Secret 'appointment-scheduling-secret' rendered in namespace '$NS' ──"
