# ─────────────────────────────────────────────────────────────────────────
# dev environment — module composition:
#   network → ecr + github-oidc + s3-assets (parallel)
#         → rds-postgres → ec2-k3s → monitoring
# ─────────────────────────────────────────────────────────────────────────

# ─── NEXTAUTH_SECRET in SSM (generated and stored as SecureString) ───────
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

# Google Calendar Service Account private key.
# Terraform creates the parameter with a placeholder; update the real value
# once via AWS Console or CLI after the first terraform apply:
#   aws ssm put-parameter --name /${var.name_prefix}/google/calendar-private-key \
#     --type SecureString --value "$(cat key.json | jq -r .private_key)" --overwrite
resource "aws_ssm_parameter" "google_calendar_key" {
  name        = "/${var.name_prefix}/google/calendar-private-key"
  description = "Google Calendar Service Account private key for ${var.name_prefix}"
  type        = "SecureString"
  value       = "PLACEHOLDER — replace with the private_key from the Service Account JSON"
  tags = {
    Component = "secrets"
  }
  lifecycle {
    ignore_changes = [value]
  }
}

# ─── Public hostname in SSM (non-secret String) ──────────────────────────
# Single source of truth for the environment's host. CI reads this at deploy
# time (same pattern as db/url and the secrets above) to set the ingress host,
# NEXTAUTH_URL and NEXT_PUBLIC_APP_URL — no hostname hardcoded in the pipeline.
resource "aws_ssm_parameter" "app_host" {
  name        = "/${var.name_prefix}/app/host"
  description = "Public hostname (A record → EIP) for ${var.name_prefix}"
  type        = "String"
  # SSM rejects empty String values. Fall back to the placeholder when app_host
  # is unset (the deploy would then run on the placeholder host, not crash apply).
  value       = var.app_host != "" ? var.app_host : "appointment-scheduling.example.com"
  tags = {
    Component = "app"
  }
}

# ─── Derived values ──────────────────────────────────────────────────────
locals {
  # Browser origins allowed to upload/read gallery assets in S3 (CORS).
  # Derived from app_host so they never go stale; localhost stays for local dev.
  app_cors_origins = concat(
    ["http://localhost:3000"],
    var.app_host != "" ? ["https://${var.app_host}", "http://${var.app_host}"] : [],
  )
}

# ─── Modules ─────────────────────────────────────────────────────────────
module "network" {
  source = "../../modules/network"

  name                = var.name_prefix
  vpc_cidr            = "10.0.0.0/16"
  public_subnet_cidrs = ["10.0.0.0/24", "10.0.1.0/24"]
  db_subnet_cidrs     = ["10.0.10.0/24", "10.0.11.0/24"]
  availability_zones  = ["${var.region}a", "${var.region}b"]

  tags = { Component = "network" }
}

module "ecr" {
  source = "../../modules/ecr"

  repository_name      = "${var.name_prefix}-nextjs"
  image_tag_mutability = "MUTABLE"
  scan_on_push         = true
  max_image_count      = 10
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

module "ses" {
  source = "../../modules/ses"

  name_prefix = var.name_prefix
  tags        = { Component = "email" }
}

module "s3_assets" {
  source      = "../../modules/s3-assets"
  bucket_name = "${var.name_prefix}-assets"
  allowed_origins = local.app_cors_origins
  tags            = { Component = "storage" }
}

module "rds" {
  source = "../../modules/rds-postgres"

  name          = var.name_prefix
  vpc_id        = module.network.vpc_id
  db_subnet_ids = module.network.db_subnet_ids

  # WARNING: the k3s→db ingress is NOT passed here to avoid cycle
  # rds ↔ k3s. The rule is created separately below, when both SGs exist.
  allowed_security_group_ids = []

  instance_class       = "db.t3.micro"
  allocated_storage_gb = 20
  storage_type         = "gp3"

  db_name               = "appointment_scheduling"
  db_username           = "appsched"
  deletion_protection   = false
  skip_final_snapshot   = true
  multi_az              = false
  publicly_accessible   = false
  backup_retention_days = 0  # Disabled in dev (saves cost; no automated backups)

  tags = { Component = "database" }
}

# ─── k3s → RDS ingress (breaks the module-to-module cycle) ──────────────
# Created ONLY if k3s is enabled. Lives here — not in the rds module —
# because rds should not depend on k3s and k3s already depends on rds (via SSM).
resource "aws_security_group_rule" "k3s_to_db" {
  count = var.enable_ec2_k3s ? 1 : 0

  type                     = "ingress"
  description              = "Postgres 5432 from k3s SG"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = module.k3s[0].instance_security_group_id
  security_group_id        = module.rds.db_security_group_id
}

module "k3s" {
  count  = var.enable_ec2_k3s ? 1 : 0
  source = "../../modules/ec2-k3s"

  name      = "${var.name_prefix}-k3s"
  vpc_id    = module.network.vpc_id
  subnet_id = module.network.public_subnet_ids[0]

  instance_type       = var.instance_type
  spot_instance_types = var.spot_instance_types

  github_owner   = var.github_owner
  github_repo    = var.github_repo
  github_token   = var.github_token
  runner_labels  = var.runner_labels
  git_branch     = var.git_branch
  kustomize_overlay = var.kustomize_overlay

  image_ref     = var.image_ref != "" ? var.image_ref : "${module.ecr.repository_url}:latest"
  aws_region    = var.region
  # app_host (e.g. dev.vjbeautystudio.com) becomes the resolved host for the
  # outputs, the first-boot user-data, AND the SSM param the CI reads. Empty
  # falls back to <name_prefix>.<ip>.nip.io inside the module.
  public_host          = var.app_host
  public_host_prefix   = var.name_prefix
  app_namespace = "appointment-scheduling-dev"

  database_url_ssm_parameter    = module.rds.database_url_ssm_parameter
  nextauth_secret_ssm_parameter = aws_ssm_parameter.nextauth_secret.name
  s3_bucket_name                = module.s3_assets.bucket_name
  ses_from_email                = var.ses_from_email
  enable_emails                 = var.enable_emails

  # Attach the assets bucket policy to the instance profile.
  # (SES can be added later with AmazonSESFullAccess or a custom policy.)
  extra_managed_policy_arns = [
    module.s3_assets.app_access_policy_arn,
    module.ses.send_policy_arn,
  ]

  ami_id                  = var.ec2_ami
  cloudwatch_agent_config = true
  enable_letsencrypt      = var.enable_letsencrypt
  letsencrypt_email       = coalesce(
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

# ── RDS Scheduler — apaga la BD por horario para ahorrar (dev) ──────────
# Enable with: enable_rds_scheduler = true in terraform.tfvars
module "rds_scheduler" {
  count  = var.enable_rds_scheduler ? 1 : 0
  source = "../../modules/rds-scheduler"

  name_prefix            = var.name_prefix
  db_instance_identifier = module.rds.db_instance_identifier
  db_instance_arn        = module.rds.db_instance_arn

  # Horario parametrizado desde el ambiente (cron + timezone)
  stop_schedule     = var.rds_stop_schedule
  start_schedule    = var.rds_start_schedule
  schedule_timezone = var.rds_schedule_timezone

  tags = { Component = "cost-optimization" }
}
