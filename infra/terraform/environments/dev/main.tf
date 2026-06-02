# ─────────────────────────────────────────────────────────────────────────
# dev environment — composición de módulos:
#   network → ecr + github-oidc + s3-assets (paralelo)
#         → rds-postgres → ec2-k3s → monitoring
# ─────────────────────────────────────────────────────────────────────────

# ─── NEXTAUTH_SECRET en SSM (generado y stored en SecureString) ───────────
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

# ─── Módulos ──────────────────────────────────────────────────────────────
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
  allowed_origins = [
    "http://localhost:3000",
    "http://appointment-scheduling-dev.54-157-5-72.nip.io",
    "https://appointment-scheduling-dev.54-157-5-72.nip.io"
  ]
  tags = { Component = "storage" }
}

module "rds" {
  source = "../../modules/rds-postgres"

  name          = var.name_prefix
  vpc_id        = module.network.vpc_id
  db_subnet_ids = module.network.db_subnet_ids

  # OJO: el ingress k3s→db NO se pasa por aquí para no crear ciclo
  # rds ↔ k3s. La regla se crea aparte abajo, cuando ambos SGs existen.
  allowed_security_group_ids = []

  instance_class       = "db.t3.micro"
  allocated_storage_gb = 20
  storage_type         = "gp2"

  db_name             = "appointment_scheduling"
  db_username         = "appsched"
  deletion_protection = false
  skip_final_snapshot = true
  multi_az            = false
  publicly_accessible = false

  tags = { Component = "database" }
}

# ─── Ingress k3s → RDS (rompe el ciclo módulo a módulo) ──────────────────
# Se crea SOLO si k3s está habilitado. Vive aquí — no en el módulo rds —
# porque rds no debe depender de k3s y k3s ya depende de rds (via SSM).
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
  public_host          = ""
  public_host_prefix   = var.name_prefix
  app_namespace = "appointment-scheduling-dev"

  database_url_ssm_parameter    = module.rds.database_url_ssm_parameter
  nextauth_secret_ssm_parameter = aws_ssm_parameter.nextauth_secret.name
  s3_bucket_name                = module.s3_assets.bucket_name
  ses_from_email                = var.ses_from_email
  enable_emails                 = var.enable_emails

  # Adjuntamos la policy del bucket de assets al instance profile.
  # (SES se puede sumar después con AmazonSESFullAccess o una policy custom.)
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
