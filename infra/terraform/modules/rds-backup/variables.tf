# ─────────────────────────────────────────────────────────────────────────
# rds-backup — variables
# ─────────────────────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefijo para nombrar recursos (ej. 'appointment-scheduling-prod')."
  type        = string
}

variable "db_instance_arn" {
  description = "ARN de la instancia RDS a proteger."
  type        = string
}

# ── Retenciones (días) ────────────────────────────────────────────────────

variable "daily_retention_days" {
  description = "Días de retención para el backup diario."
  type        = number
  default     = 30
}

variable "weekly_retention_days" {
  description = "Días de retención para el backup semanal."
  type        = number
  default     = 90
}

variable "monthly_retention_days" {
  description = "Días de retención para el backup mensual."
  type        = number
  default     = 365
}

# ── Ventana horaria (UTC) ─────────────────────────────────────────────────
# 03:00 Bogotá (UTC-5) = 08:00 UTC.
# La ventana de 1 h es suficiente para una BD de bajo volumen.

variable "backup_window_utc" {
  description = "Hora de inicio del backup en formato cron UTC (sin 'cron()')."
  type        = string
  default     = "0 8 * * ? *"  # 03:00 Bogotá / 08:00 UTC
}

# ── Vault ────────────────────────────────────────────────────────────────

variable "vault_kms_key_arn" {
  description = "ARN de KMS key para cifrar el vault. null = AWS managed key."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags comunes a todos los recursos."
  type        = map(string)
  default     = {}
}
