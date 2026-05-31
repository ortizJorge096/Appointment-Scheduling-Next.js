# `infra/` — Infraestructura completa de appointment-scheduling

Multi-environment (dev + prod), AWS Free Tier friendly, sin claves estáticas.

## Layout

```
infra/
├── terraform/
│   ├── bootstrap/                 # State bucket S3 (correr UNA vez)
│   ├── modules/
│   │   ├── network/               # VPC + 2 AZs públicas + 2 AZs privadas DB
│   │   ├── ecr/                   # Registro Docker privado
│   │   ├── github-oidc/           # OIDC provider + role para GH Actions
│   │   ├── rds-postgres/          # RDS Postgres + SSM para DATABASE_URL
│   │   ├── s3-assets/             # Bucket de galería + CORS + IAM policy
│   │   ├── ec2-k3s/               # k3s sobre EC2 + ASG + EIP + cert-manager
│   │   └── monitoring/            # CloudWatch alarms + SNS
│   └── environments/
│       ├── dev/                   # t3.micro Free Tier, sin TLS
│       └── prod/                  # t3.medium + Let's Encrypt
├── k8s/
│   ├── base/                      # Deployment + initContainer (prisma migrate),
│   │                              # Service, Ingress, ConfigMap, Secret,
│   │                              # HPA, PDB, NetworkPolicy, Namespace
│   └── overlays/
│       ├── local/                 # minikube / docker-desktop
│       ├── dev/                   # appointment-scheduling-dev namespace
│       └── prod/                  # + TLS patch (Let's Encrypt)
└── docs/decisions/                # 9 ADRs documentando cada elección
```

## Arquitectura

```
GitHub push → Actions
  ├ lint, typecheck, gitleaks, validate-k8s
  ├ build-push → ECR (OIDC, sin keys)
  ├ trivy scan
  └ deploy (self-hosted runner ON the EC2)
                              │
                              ▼
                  ┌──────────────────────────┐
                  │  AWS (us-east-1)         │
                  │                          │
                  │  ASG desired=1 ─── EIP   │
                  │   └ EC2 + k3s            │
                  │      ├ traefik + tls     │
                  │      ├ cert-manager      │
                  │      └ Deployment ──┐    │
                  │                     │    │
                  │  RDS db.t3.micro ◀──┘    │
                  │  S3 assets (gallery/*)   │
                  │  SSM (DATABASE_URL,      │
                  │       NEXTAUTH_SECRET)   │
                  │  CloudWatch + SNS        │
                  └──────────────────────────┘
```

## Quick start

### 1. Pre-requisitos

- AWS CLI configurado (`aws configure`).
- Terraform >= 1.10.
- Node 20+ (para el dev local).
- GitHub PAT fine-grained con `Administration: read+write` sobre el repo
  (solo para registrar el self-hosted runner en boot).

### 2. Bootstrap del state bucket (una vez por cuenta)

```bash
cd infra/terraform/bootstrap
terraform init
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
terraform apply -var="state_bucket_name=appointment-scheduling-tfstate-${ACCOUNT_ID}"
```

Anota el output `state_bucket_name`.

### 3. Editar `backend.tf` de cada environment

`infra/terraform/environments/{dev,prod}/backend.tf` → sustituye
`appointment-scheduling-tfstate` por el bucket del paso anterior.

### 4. Apply dev

```bash
cd infra/terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
# Edita: github_owner, github_repo, alarm_email, github_token, ses_from_email
terraform init
terraform plan
terraform apply
```

Outputs importantes:
- `github_actions_role_arn` → ponlo como `AWS_ROLE_ARN` en el GitHub
  Environment `dev`.
- `app_url` → ponlo como variable `APP_URL` en el GitHub Environment `dev`.
- `db_endpoint`, `assets_bucket_name`, `ssm_session_command`.

### 5. Apply prod

```bash
cd ../prod
cp terraform.tfvars.example terraform.tfvars
# Igual: github_owner, github_repo, alarm_email, github_token, ses_from_email
# IMPORTANTE: create_oidc_provider = false (lo creó dev)
terraform init
terraform plan
terraform apply
```

### 6. GitHub Environments

Crea dos environments en GitHub: **`dev`** (branch `develop`) y
**`production`** (branch `main`). En cada uno:

| Nombre | Tipo | Valor |
|---|---|---|
| `AWS_ROLE_ARN` | Secret | output `github_actions_role_arn` |
| `APP_URL` | Variable | output `app_url` o `app_url_https` |

### 7. CI/CD

- Push a `develop` → build, push a ECR `<env>-dev-nextjs`, deploy a
  namespace `appointment-scheduling-dev`.
- Push a `main` → build, push a ECR `<env>-prod-nextjs`, deploy a
  namespace `appointment-scheduling` con TLS Let's Encrypt activo.

## Free Tier — costos estimados

| Recurso | Free Tier | Después |
|---|---|---|
| EC2 t3.micro (dev) | 750h/mo durante 12 meses | ~$8/mo on-demand, ~$2/mo Spot |
| EC2 t3.medium (prod) | NO cubierto | ~$30/mo on-demand, ~$8/mo Spot |
| RDS db.t3.micro | 750h/mo + 20 GB durante 12 meses | ~$15/mo |
| ECR Private | 500 MB | $0.10/GB/mo |
| S3 (state + assets) | 5 GB + 20k GET + 2k PUT | $0.023/GB |
| SSM Standard Tier | 10k parameters | free |
| Elastic IP | gratis mientras esté attached | $3.60/mo si lo dejas suelto |
| CloudWatch alarms | 10 free | $0.10/alarm/mo |

**Total Free Tier window (solo dev):** ~$2/mo (Spot premium).
**Total post Free Tier (dev + prod):** ~$30-50/mo según uso.

## Manejo de secrets

- **DATABASE_URL:** Terraform genera password aleatorio → guarda en SSM
  SecureString → user-data lo lee con instance profile → crea K8s Secret.
- **NEXTAUTH_SECRET:** mismo patrón (resource `random_password`).
- **AWS creds en runtime:** ninguna. El SDK usa el instance profile.
- **GitHub PAT:** solo se usa en boot (registrar runner) y se redacta del log.

## Operación

### Shell en el nodo

```bash
aws ssm start-session --target $(terraform output -raw asg_name | xargs ...)
# Más simple:
$(terraform output -raw ssm_session_command)
```

### Forzar deploy manual

Desde una shell en el nodo:

```bash
bash /opt/app/repo/scripts/k8s-deploy.sh prod appointment-scheduling \
  <ecr_url>:<tag> main
```

### Migrar Spot → on-demand temporalmente

Editar `terraform.tfvars` del environment:

```hcl
on_demand_percentage_above_base_capacity = 100
```

`terraform apply`. La ASG cambia de pool sin re-crear el Launch Template.

### Tear down

```bash
cd infra/terraform/environments/<env>
terraform destroy
```

Para prod: primero pon `db_deletion_protection = false` y `db_skip_final_snapshot = true`,
apply para que tome efecto, y luego destroy.

## ADRs

Las decisiones de arquitectura están en `infra/docs/decisions/`:

| # | Tema |
|---|---|
| 001 | k3s sobre EC2 (vs EKS) |
| 002 | Terraform S3 native locking (sin DynamoDB) |
| 003 | Amazon ECR como registro primario |
| 004 | Single-AZ deployment |
| 005 | RDS PostgreSQL single-AZ |
| 006 | Migraciones Prisma vía init container |
| 007 | TLS con Let's Encrypt + nip.io |
| 008 | Spot recovery con ASG |
| 009 | SSM Parameter Store para runtime secrets |
