# ─────────────────────────────────────────────────────────────────────────
# prod environment — same composition as dev but with:
#   - Let's Encrypt enabled (real cert)
#   - RDS with deletion_protection and final snapshot
#   - t3.medium (enough RAM for 2 replicas + runner + cert-manager)
#   - create_oidc_provider = false (dev created it)
# ─────────────────────────────────────────────────────────────────────────

resource "random_password" "nextauth" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "nextauth_secret" {
  name        = "/${var.name_prefix}/nextauth/secret"
  description = "NEXTAUTH_SECRET for appointment-scheduling ${var.name_prefix}"
  type        = "SecureString"
  value       = random_password.nextauth.result
  tags = {
    Component = "secrets"
  }
  lifecycle {
    ignore_changes = [value]
  }
}

# Provisioned "by code": set TF_VAR_google_private_key (or a gitignored tfvars)
# and `terraform apply` writes the real value on first create. `ignore_changes`
# keeps it stable afterward, so an already-set value is never clobbered by an
# empty var. Rotate by updating the SSM value out-of-band.
resource "aws_ssm_parameter" "google_calendar_key" {
  name        = "/${var.name_prefix}/google/calendar-private-key"
  description = "Google Calendar Service Account private key for ${var.name_prefix}"
  type        = "SecureString"
  value       = var.google_private_key != "" ? var.google_private_key : "PLACEHOLDER — set TF_VAR_google_private_key or update the SSM value out-of-band"
  tags = {
    Component = "secrets"
  }
  lifecycle {
    ignore_changes = [value]
  }
}

# Resend API key (email delivery). Provisioned "by code" like the Google key:
# set TF_VAR_resend_api_key (or a gitignored tfvars) and apply writes it once;
# ignore_changes keeps it stable so an empty var never clobbers a real value.
resource "aws_ssm_parameter" "resend_api_key" {
  name        = "/${var.name_prefix}/resend/api-key"
  description = "Resend API key for ${var.name_prefix}"
  type        = "SecureString"
  value       = var.resend_api_key != "" ? var.resend_api_key : "PLACEHOLDER — set TF_VAR_resend_api_key or update the SSM value out-of-band"
  tags = {
    Component = "secrets"
  }
  lifecycle {
    ignore_changes = [value]
  }
}

# ─── Public hostname in SSM (non-secret String) ──────────────────────────
# Single source of truth for the prod host. CI reads it at deploy time to set
# the ingress host, NEXTAUTH_URL and NEXT_PUBLIC_APP_URL — no host hardcoded.
resource "aws_ssm_parameter" "app_host" {
  name        = "/${var.name_prefix}/app/host"
  description = "Public hostname (A record → EIP) for ${var.name_prefix}"
  type        = "String"
  # SSM rejects empty String values. Fall back to the placeholder when app_host
  # is unset (the deploy would then run on the placeholder host, not crash apply).
  value = var.app_host != "" ? var.app_host : "appointment-scheduling.example.com"
  tags  = { Component = "app" }
}

locals {
  # Browser origins allowed to upload/read gallery assets in S3 (CORS), derived
  # from app_host so they never go stale; localhost stays for local dev.
  app_cors_origins = concat(
    ["http://localhost:3000"],
    var.app_host != "" ? ["https://${var.app_host}", "http://${var.app_host}"] : [],
  )
}

module "network" {
  source = "../../modules/network"

  name                = var.name_prefix
  vpc_cidr            = "10.10.0.0/16"
  public_subnet_cidrs = ["10.10.0.0/24", "10.10.1.0/24"]
  db_subnet_cidrs     = ["10.10.10.0/24", "10.10.11.0/24"]
  availability_zones  = ["${var.region}a", "${var.region}b"]

  tags = { Component = "network" }
}

module "ecr" {
  source = "../../modules/ecr"

  repository_name      = "${var.name_prefix}-nextjs"
  image_tag_mutability = "MUTABLE"
  scan_on_push         = true
  max_image_count      = 15
  tags                 = { Component = "registry" }
}

module "github_oidc" {
  source               = "../../modules/github-oidc"
  create_oidc_provider = var.create_oidc_provider

  github_owner         = var.github_owner
  github_repo          = var.github_repo
  allowed_branches     = var.allowed_branches
  allowed_environments = var.allowed_environments
  ecr_repository_arn   = module.ecr.repository_arn
  role_name            = "${var.name_prefix}-gha-deploy"

  tags = { Component = "ci" }
}

module "s3_assets" {
  source          = "../../modules/s3-assets"
  bucket_name     = "${var.name_prefix}-assets"
  allowed_origins = local.app_cors_origins
  public_prefixes = ["gallery/", "testimonios/", "hero/"]
  tags            = { Component = "storage" }
}

# The rds module gained `count` (ADR-013 teardown gate). Without this, Terraform
# reads the pre-count state address (module.rds.*) as "destroy" and the new one
# (module.rds[0].*) as "create" — i.e. it would destroy + recreate the prod DB.
# `moved` MIGRATES the existing instance into index 0 instead. Harmless once the
# state is already at [0] (the move becomes a no-op).
moved {
  from = module.rds
  to   = module.rds[0]
}

module "rds" {
  source = "../../modules/rds-postgres"

  # Gated (ADR-013) so the local prod DB can be torn down after migrating to an
  # external cross-account DB. See enable_local_rds / external_database_url. The
  # teardown honors db_skip_final_snapshot (false) → a FINAL SNAPSHOT is taken;
  # flip db_deletion_protection=false first.
  count = var.enable_local_rds ? 1 : 0

  name          = var.name_prefix
  vpc_id        = module.network.vpc_id
  db_subnet_ids = module.network.db_subnet_ids

  # k3s→db ingress is created below at environment level (avoids cycle).
  allowed_security_group_ids = []

  instance_class           = "db.t3.micro"
  allocated_storage_gb     = 20
  max_allocated_storage_gb = 100 # autoscaling hasta 100 GB
  storage_type             = "gp3"

  db_name             = "appointment_scheduling"
  db_username         = "appsched"
  deletion_protection = var.db_deletion_protection
  skip_final_snapshot = var.db_skip_final_snapshot
  multi_az            = false # change to true when leaving Free Tier
  publicly_accessible = false
  # Minimal safety net only: 1 day of FREE point-in-time recovery (RDS automated
  # backups up to the DB size cost nothing, so this is $0). It is the last undo
  # for an accidental DELETE or a bad migration on client + payment data — do not
  # take it to 0. 7 is also free if a longer window is ever wanted. The
  # long-retention AWS Backup vault below stays off (var.enable_aws_backup): that
  # is the part that actually costs (30/90/365-day snapshot storage).
  backup_retention_days = 1

  tags = { Component = "database" }
}

# External DATABASE_URL (cross-account prod DB, ADR-013). Published to the SAME SSM
# path the app reads, but ONLY when set — so it never collides with the local
# module's param (that one exists only while enable_local_rds = true). Cutover is a
# two-step apply (tear down local first, then set this) to avoid a name clash.
resource "aws_ssm_parameter" "database_url_external" {
  count       = var.external_database_url != "" ? 1 : 0
  name        = "/${var.name_prefix}/db/url"
  description = "External DATABASE_URL (cross-account prod DB, ADR-013)."
  type        = "SecureString"
  value       = var.external_database_url
  tags        = { Component = "database" }
}

# ─── Long-retention backups via AWS Backup (vault + daily/weekly/monthly) ──
# Off (enable_aws_backup = false) — overkill for this site, and the vault's
# snapshot storage is the only backup cost. The DB keeps 1-day free PITR above.
# Set enable_aws_backup = true to bring back the 30/90/365-day vault.
module "rds_backup" {
  # No local RDS to back up once migrated to an external DB (ADR-013).
  count  = (var.enable_aws_backup && var.enable_local_rds) ? 1 : 0
  source = "../../modules/rds-backup"

  name_prefix     = var.name_prefix
  db_instance_arn = module.rds[0].db_instance_arn

  # Bogotá UTC-5: 03:00 local = 08:00 UTC
  backup_window_utc = "0 8 * * ? *"

  daily_retention_days   = 30
  weekly_retention_days  = 90
  monthly_retention_days = 365

  tags = { Component = "backup" }
}

# ─── k3s → RDS ingress (rule in environment to avoid cycle) ─────────────
resource "aws_security_group_rule" "k3s_to_db" {
  # Only when BOTH the cluster and the LOCAL db exist (ADR-013): with an external
  # DB there's no local SG to attach this to.
  count = (var.enable_ec2_k3s && var.enable_local_rds) ? 1 : 0

  type                     = "ingress"
  description              = "Postgres 5432 from k3s SG"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = module.k3s[0].instance_security_group_id
  security_group_id        = module.rds[0].db_security_group_id
}

module "k3s" {
  count  = var.enable_ec2_k3s ? 1 : 0
  source = "../../modules/ec2-k3s"

  name      = "${var.name_prefix}-k3s"
  vpc_id    = module.network.vpc_id
  subnet_id = module.network.public_subnet_ids[0]

  instance_type       = var.instance_type
  spot_instance_types = var.spot_instance_types

  github_owner      = var.github_owner
  github_repo       = var.github_repo
  github_token      = var.github_token
  runner_labels     = var.runner_labels
  git_branch        = var.git_branch
  kustomize_overlay = var.kustomize_overlay

  image_ref  = var.image_ref != "" ? var.image_ref : "${module.ecr.repository_url}:latest"
  aws_region = var.region
  # app_host (vjbeautystudio.com) becomes the resolved host for outputs, the
  # first-boot user-data AND the SSM param the CI reads. Empty → nip.io fallback.
  public_host   = var.app_host
  app_namespace = "appointment-scheduling"

  # Local module's SSM param while the local DB exists; otherwise the fixed path
  # the external param publishes to (ADR-013).
  database_url_ssm_parameter        = var.enable_local_rds ? module.rds[0].database_url_ssm_parameter : "/${var.name_prefix}/db/url"
  nextauth_secret_ssm_parameter     = aws_ssm_parameter.nextauth_secret.name
  google_calendar_key_ssm_parameter = aws_ssm_parameter.google_calendar_key.name
  resend_api_key_ssm_parameter      = aws_ssm_parameter.resend_api_key.name
  s3_bucket_name                    = module.s3_assets.bucket_name
  ses_from_email                    = var.ses_from_email
  enable_emails                     = var.enable_emails

  extra_managed_policy_arns = [
    module.s3_assets.app_access_policy_arn,
  ]

  cloudwatch_agent_config = true
  enable_letsencrypt      = var.enable_letsencrypt
  letsencrypt_email = coalesce(
    var.letsencrypt_email != "" ? var.letsencrypt_email : null,
    var.alarm_email != "" ? var.alarm_email : null,
    "devops-notify@example.com"
  )

  tags = {
    Component = "runtime"
    Project   = var.github_repo
  }
}

module "monitoring" {
  count  = (var.enable_ec2_k3s && var.enable_monitoring) ? 1 : 0
  source = "../../modules/monitoring"

  name        = var.name_prefix
  alarm_email = var.alarm_email
  asg_name    = module.k3s[0].asg_name

  cpu_threshold_percent     = 80
  memory_threshold_percent  = 85
  disk_threshold_percent    = 80
  enable_memory_disk_alarms = true

  tags = { Component = "observability" }
}

# ── ASG Scheduler — scale compute to 0/1 on a schedule to save cost ─────
# Disabled by default. Enable with enable_compute_scheduler = true.
module "asg_scheduler" {
  count  = (var.enable_ec2_k3s && var.enable_compute_scheduler) ? 1 : 0
  source = "../../modules/asg-scheduler"

  name_prefix = var.name_prefix
  asg_name    = module.k3s[0].asg_name
  asg_arn     = module.k3s[0].asg_arn

  stop_schedule     = var.compute_stop_schedule
  start_schedule    = var.compute_start_schedule
  schedule_timezone = var.compute_schedule_timezone

  tags = { Component = "cost-optimization" }
}

# ── RDS Scheduler — apaga/enciende la BD por horario (ahorro de costo) ───
# Off por defecto. Activar con enable_rds_scheduler = true.
# TODO: parametrizar los horarios de apagado/encendido (hoy fijos en el módulo).
module "rds_scheduler" {
  # No local RDS to schedule once migrated to an external DB (ADR-013).
  count  = (var.enable_rds_scheduler && var.enable_local_rds) ? 1 : 0
  source = "../../modules/rds-scheduler"

  name_prefix            = var.name_prefix
  db_instance_identifier = module.rds[0].db_instance_identifier
  db_instance_arn        = module.rds[0].db_instance_arn

  # Horario parametrizado desde el ambiente (cron + timezone)
  stop_schedule     = var.rds_stop_schedule
  start_schedule    = var.rds_start_schedule
  schedule_timezone = var.rds_schedule_timezone

  tags = { Component = "cost-optimization" }
}
