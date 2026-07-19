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
#   render-app-secret.sh <namespace> <db_url_ssm> <nextauth_ssm> <google_key_ssm> <resend_key_ssm> [region] [cron_secret_ssm]
#
# kubectl uses the ambient context: KUBECONFIG in user-data, ~/.kube/config on
# the self-hosted runner.
set -euo pipefail

NS="${1:?namespace required}"
DB_URL_SSM="${2:?db url SSM parameter name required}"
NEXTAUTH_SSM="${3:?nextauth SSM parameter name required}"
GOOGLE_KEY_SSM="${4:?google key SSM parameter name required}"
RESEND_KEY_SSM="${5:?resend key SSM parameter name required}"
REGION="${6:-us-east-1}"
# Optional: SSM param holding the shared secret for the scheduled-jobs endpoint
# (POST /api/cron). If unset, the endpoint stays locked (401) — fail-safe.
CRON_SECRET_SSM="${7:-}"

ssm() { aws ssm get-parameter --region "$REGION" --name "$1" --with-decryption --query 'Parameter.Value' --output text; }

DATABASE_URL="$(ssm "$DB_URL_SSM")"
NEXTAUTH_SECRET="$(ssm "$NEXTAUTH_SSM")"
# The Google key may legitimately be unset/placeholder — tolerate a read failure.
GOOGLE_PRIVATE_KEY="$(ssm "$GOOGLE_KEY_SSM" 2>/dev/null || true)"
# The Resend API key may also be unset/placeholder — tolerate a read failure.
RESEND_API_KEY="$(ssm "$RESEND_KEY_SSM" 2>/dev/null || true)"
# Optional cron secret — only read when its SSM param name was provided.
CRON_SECRET=""
if [ -n "$CRON_SECRET_SSM" ]; then
  CRON_SECRET="$(ssm "$CRON_SECRET_SSM" 2>/dev/null || true)"
fi

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

# Include RESEND_API_KEY only when it's a real value — otherwise emails stay
# cleanly disabled (env.ts requires it only when ENABLE_EMAILS=true).
case "$RESEND_API_KEY" in
  "" | PLACEHOLDER* | None)
    echo "note: Resend API key not set in SSM ($RESEND_KEY_SSM) — emails stay disabled" >&2
    ;;
  *)
    args+=(--from-literal=RESEND_API_KEY="$RESEND_API_KEY")
    ;;
esac

# CRON_SECRET secures the scheduled-jobs endpoint (/api/cron). Make it zero-touch:
# prefer the SSM value; else reuse whatever is already in the Secret (so it does
# NOT rotate on every deploy); else generate one. The app and the CronJob read the
# same Secret key, so a generated value still matches — no manual step needed.
case "$CRON_SECRET" in
  "" | PLACEHOLDER* | None)
    CRON_SECRET="$(kubectl -n "$NS" get secret appointment-scheduling-secret -o jsonpath='{.data.CRON_SECRET}' 2>/dev/null | base64 -d 2>/dev/null || true)"
    ;;
esac
if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "note: CRON_SECRET auto-generated (set ${CRON_SECRET_SSM:-an SSM param} for a managed value)" >&2
fi
args+=(--from-literal=CRON_SECRET="$CRON_SECRET")

kubectl -n "$NS" create secret generic appointment-scheduling-secret \
  "${args[@]}" \
  --dry-run=client -o yaml | kubectl -n "$NS" apply -f -

echo "── Secret 'appointment-scheduling-secret' rendered in namespace '$NS' ──"
