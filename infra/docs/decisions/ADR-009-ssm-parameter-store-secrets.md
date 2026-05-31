# ADR-009 — SSM Parameter Store para runtime secrets

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

`DATABASE_URL` y `NEXTAUTH_SECRET` son sensibles. Necesitan ser:
- generados de forma segura,
- NO commiteados,
- NO visibles en el Terraform state plano,
- accesibles al EC2 sin pasar por OIDC ni keys.

Opciones:

1. **AWS Secrets Manager** — $0.40/mo por secreto + $0.05/10k requests.
2. **SSM Parameter Store SecureString** — gratis hasta 10k Standard
   Tier parameters.
3. **K8s Sealed Secrets** — controller en cluster + repo de keys.
4. **External Secrets Operator + Vault** — overkill para este scope.

## Decisión

**SSM Parameter Store SecureString** + KMS managed key (`alias/aws/ssm`).

## Por qué

- **Gratis** dentro del Standard Tier (4 KB por parámetro, suficiente).
- **Lectura nativa** desde el instance profile con permisos
  `ssm:GetParameter` + `kms:Decrypt` con la condición
  `kms:ViaService = ssm.<region>.amazonaws.com`.
- **No hace falta otro controller** dentro del cluster.
- **Auditable** vía CloudTrail.

## Flujo

1. Terraform crea/rota el `random_password`.
2. Terraform escribe a SSM con `lifecycle { ignore_changes = [value] }`
   para que apply siguientes no re-escriban.
3. User-data llama `aws ssm get-parameter --with-decryption` con el
   instance profile y crea el K8s Secret.
4. Init container + app container leen del Secret vía `envFrom`.

## Rotación manual

```bash
aws ssm put-parameter --name /<env>/db/password --type SecureString \
  --value "$(openssl rand -base64 32)" --overwrite

# Triggar refresh del EC2 (reapply del overlay desde el runner) o
# editar el Secret directamente:
kubectl -n <ns> create secret generic appointment-scheduling-secret ...
```

## Cuándo migrar a Secrets Manager

- Si necesitas **rotación automática** (RDS native rotation).
- Si los parámetros pasan el límite de Standard Tier (4 KB).
- Cuando entres a multi-account y necesites cross-account access.
