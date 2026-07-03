# ─────────────────────────────────────────────────────────────────────────
# rds-backup — variables
# ─────────────────────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix for naming resources (e.g. 'appointment-scheduling-prod')."
  type        = string
}

variable "db_instance_arn" {
  description = "ARN of the RDS instance to protect."
  type        = string
}

# ── Retention (days) ─────────────────────────────────────────────────────

variable "daily_retention_days" {
  description = "Retention days for the daily backup."
  type        = number
  default     = 30
}

variable "weekly_retention_days" {
  description = "Retention days for the weekly backup."
  type        = number
  default     = 90
}

variable "monthly_retention_days" {
  description = "Retention days for the monthly backup."
  type        = number
  default     = 365
}

# ── Time window (UTC) ────────────────────────────────────────────────────
# 03:00 Bogotá (UTC-5) = 08:00 UTC.
# The 1-hour window is sufficient for a low-volume DB.

variable "backup_window_utc" {
  description = "Backup start time in cron UTC format (without 'cron()')."
  type        = string
  default     = "0 8 * * ? *" # 03:00 Bogotá UTC-5 / 08:00 UTC
}

# ── Vault ────────────────────────────────────────────────────────────────

variable "vault_kms_key_arn" {
  description = "ARN de KMS key para cifrar el vault. null = AWS managed key."
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags for all resources."
  type        = map(string)
  default     = {}
}
