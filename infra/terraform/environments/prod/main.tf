# ─────────────────────────────────────────────────────────────────────────
# prod environment — la misma composición que dev pero con:
#   - Let's Encrypt habilitado (cert real)
#   - RDS con deletion_protection y final snapshot
#   - t3.medium (RAM suficiente para 2 réplicas + runner + cert-manager)
#   - create_oidc_provider = false (lo creó dev)
# ─────────────────────────────────────────────────────────────────────────

resource "random_password" "nextauth" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "nextauth_secret" {
  name        = "/${var.name_prefix}/nextauth/secret"
  description = "NEXTAUTH_SECRET para appointment-scheduling ${var.name_prefix}"
  type        = "SecureString"
  value       = random_password.nextauth.result
  tags = {
    Component = "secrets"
  }
  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_calendar_key" {
  name        = "/${var.name_prefix}/google/calendar-private-key"
  description = "Google Calendar Service Account private key para ${var.name_prefix}"
  type        = "SecureString"
  value       = "PLACEHOLDER — reemplazar con la private_key del JSON de la Service Account"
  tags = {
    Component = "secrets"
  }
  lifecycle {
    ignore_changes = [value]
  }
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

module "ses" {
  source = "../../modules/ses"

  name_prefix = var.name_prefix
  tags        = { Component = "email" }
}

module "s3_assets" {
  source      = "../../modules/s3-assets"
  bucket_name = "${var.name_prefix}-assets"
  allowed_origins = [
    "https://${var.name_prefix}.example.com",  # placeholder: sustituir por host real
  ]
  tags = { Component = "storage" }
}

module "rds" {
  source = "../../modules/rds-postgres"

  name          = var.name_prefix
  vpc_id        = module.network.vpc_id
  db_subnet_ids = module.network.db_subnet_ids

  # Ingress k3s→db se crea abajo a nivel de environment (evita ciclo).
  allowed_security_group_ids = []

  instance_class           = "db.t3.micro"
  allocated_storage_gb     = 20
  max_allocated_storage_gb = 100  # autoscaling hasta 100 GB
  storage_type             = "gp3"

  db_name               = "appointment_scheduling"
  db_username           = "appsched"
  deletion_protection   = var.db_deletion_protection
  skip_final_snapshot   = var.db_skip_final_snapshot
  multi_az              = false  # cambiar a true al salir del Free Tier
  publicly_accessible   = false
  backup_retention_days = 14    # 14 dias de automated backups en prod

  tags = { Component = "database" }
}

# ─── Backups con AWS Backup (vault + plan diario/semanal/mensual) ─────────
module "rds_backup" {
  source = "../../modules/rds-backup"

  name_prefix     = var.name_prefix
  db_instance_arn = module.rds.db_instance_arn

  # Bogota UTC-5: 03:00 local = 08:00 UTC
  backup_window_utc = "0 8 * * ? *"

  daily_retention_days   = 30
  weekly_retention_days  = 90
  monthly_retention_days = 365

  tags = { Component = "backup" }
}

# ─── Ingress k3s → RDS (regla en el environment para evitar ciclo) ───────
resource "aws_security_group_rule" "k3s_to_db" {
  count = var.enable_ec2_k3s ? 1 : 0

  type                     = "ingress"
  description              = "Postgres 5432 desde el SG del k3s"
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
  public_host   = ""
  app_namespace = "appointment-scheduling"

  database_url_ssm_parameter    = module.rds.database_url_ssm_parameter
  nextauth_secret_ssm_parameter = aws_ssm_parameter.nextauth_secret.name
  s3_bucket_name                = module.s3_assets.bucket_name
  ses_from_email                = var.ses_from_email
  enable_emails                 = var.enable_emails

  extra_managed_policy_arns = [
    module.s3_assets.app_access_policy_arn,
    module.ses.send_policy_arn,
  ]

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
