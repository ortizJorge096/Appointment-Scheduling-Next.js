variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix. prod = appointment-scheduling-prod."
  type        = string
  default     = "appointment-scheduling-prod"
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "allowed_branches" {
  type    = list(string)
  default = ["main", "develop"]
}

variable "allowed_environments" {
  type    = list(string)
  default = ["dev", "production"]
}

variable "create_oidc_provider" {
  description = "In prod defaults to false — the OIDC provider was created by dev."
  type        = bool
  default     = false
}

variable "git_branch" {
  type    = string
  default = "main"
}

variable "kustomize_overlay" {
  type    = string
  default = "prod"
}

variable "image_ref" {
  type    = string
  default = ""
}

variable "enable_ec2_k3s" {
  type    = bool
  default = true
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

variable "alarm_email" {
  type    = string
  default = ""
}

variable "github_token" {
  type      = string
  default   = ""
  sensitive = true
}

# Prod uses more RAM (cert-manager + 2 replicas + runner). t3.medium is NOT Free Tier.
variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "spot_instance_types" {
  type    = list(string)
  default = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "runner_labels" {
  type    = string
  default = "self-hosted,linux,x64,k3s-deploy,k3s-prod"
}

# Prod enables Let's Encrypt by default.
variable "enable_letsencrypt" {
  type    = bool
  default = true
}

variable "letsencrypt_email" {
  type    = string
  default = ""
}

variable "ses_from_email" {
  type    = string
  default = ""
}

variable "google_private_key" {
  description = "Google Calendar service-account private key. Provide via TF_VAR_google_private_key or a gitignored tfvars — NEVER commit it. Empty keeps whatever value is already in SSM (ignore_changes)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_emails" {
  type    = bool
  default = true
}

# Prod: deletion_protection on RDS.
variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = false
}

# Long-retention AWS Backup vault (30/90/365 días). Off por elección del negocio:
# la BD conserva igual 7 días de point-in-time recovery (gratis) vía RDS.
variable "enable_aws_backup" {
  type    = bool
  default = false
}

variable "enable_compute_scheduler" {
  description = "Scale the EC2 ASG to 0 on a schedule to save compute costs outside working hours (e.g. overnight)."
  type        = bool
  default     = false
}

variable "compute_stop_schedule" {
  description = "Cron expression to scale ASG to 0. Default: 22:00 Bogota."
  type        = string
  default     = "cron(0 22 * * ? *)"
}

variable "compute_start_schedule" {
  description = "Cron expression to scale ASG to 1. Default: 08:00 Bogota. Empty = manual start only."
  type        = string
  default     = "cron(0 8 * * ? *)"
}

variable "compute_schedule_timezone" {
  description = "Timezone for compute scheduler schedules."
  type        = string
  default     = "America/Bogota"
}

# Public hostname for prod (A record → Elastic IP). Single source of truth:
# feeds the module's resolved host (outputs + first-boot user-data) and the SSM
# param the CI reads for the ingress host, NEXTAUTH_URL and NEXT_PUBLIC_APP_URL.
# Empty = falls back to <name_prefix>.<ip>.nip.io.
variable "app_host" {
  type    = string
  default = ""
}

# RDS scheduler: apaga/enciende la BD por horario para ahorrar costo. Off por
# defecto. Los horarios se pasan al módulo desde aquí (cron + timezone).
variable "enable_rds_scheduler" {
  type    = bool
  default = false
}

# Apagado por defecto a las 23:00 y encendido a las 06:00 (hora Bogotá), fuera
# del horario de atención. Ajusta en terraform.tfvars si lo necesitas distinto.
variable "rds_stop_schedule" {
  type    = string
  default = "cron(0 23 * * ? *)"
}

variable "rds_start_schedule" {
  type    = string
  default = "cron(0 6 * * ? *)" # "" = sin encendido automático (manual)
}

variable "rds_schedule_timezone" {
  type    = string
  default = "America/Bogota"
}
