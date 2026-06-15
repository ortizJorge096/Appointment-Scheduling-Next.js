# ─────────────────────────────────────────────────────────────────────────
# rds-backup — AWS Backup para la instancia RDS PostgreSQL.
#
# Crea tres reglas:
#   - Diaria  : 03:00 Bogota (08:00 UTC), retencion 30 dias (var)
#   - Semanal : domingos 03:00 Bogota,    retencion 90 dias (var)
#   - Mensual : dia 1 03:00 Bogota,       retencion 365 dias (var)
#
# El vault se cifra con KMS managed key (aws/backup por defecto).
# El IAM role usa las policies administradas de AWS Backup.
# ─────────────────────────────────────────────────────────────────────────

# ─── Vault de backups ─────────────────────────────────────────────────────
resource "aws_backup_vault" "this" {
  name        = "${var.name_prefix}-db-vault"
  kms_key_arn = var.vault_kms_key_arn  # null = aws/backup managed key

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-db-vault"
    Component = "backup"
  })
}

# ─── IAM role que AWS Backup usara para hacer los snapshots ───────────────
data "aws_iam_policy_document" "backup_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["backup.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "backup" {
  name               = "${var.name_prefix}-aws-backup-role"
  assume_role_policy = data.aws_iam_policy_document.backup_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "backup_policy" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore_policy" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

# ─── Plan con tres reglas ─────────────────────────────────────────────────
resource "aws_backup_plan" "this" {
  name = "${var.name_prefix}-db-backup-plan"

  # ── Diario: 03:00 Bogota (08:00 UTC) ────────────────────────────────
  rule {
    rule_name         = "daily-bogota-0300"
    target_vault_name = aws_backup_vault.this.name
    schedule          = "cron(${var.backup_window_utc})"

    lifecycle {
      delete_after = var.daily_retention_days
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.this.arn
    }
  }

  # ── Semanal: domingos 08:00 UTC ──────────────────────────────────────
  rule {
    rule_name         = "weekly-sunday"
    target_vault_name = aws_backup_vault.this.name
    schedule          = "cron(0 8 ? * 1 *)"

    lifecycle {
      delete_after = var.weekly_retention_days
    }
  }

  # ── Mensual: dia 1 de cada mes 08:00 UTC ─────────────────────────────
  rule {
    rule_name         = "monthly-first"
    target_vault_name = aws_backup_vault.this.name
    schedule          = "cron(0 8 1 * ? *)"

    lifecycle {
      delete_after = var.monthly_retention_days
    }
  }

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-db-backup-plan"
    Component = "backup"
  })
}

# ─── Seleccion: apunta a la instancia RDS por ARN ─────────────────────────
resource "aws_backup_selection" "rds" {
  name         = "${var.name_prefix}-rds-selection"
  plan_id      = aws_backup_plan.this.id
  iam_role_arn = aws_iam_role.backup.arn

  resources = [var.db_instance_arn]
}
