# ─────────────────────────────────────────────────────────────────────────
# rds-backup — AWS Backup for the RDS PostgreSQL instance.
#
# Creates three rules:
#   - Daily   : 03:00 Bogotá (08:00 UTC), 30 day retention (var)
#   - Weekly  : Sundays 03:00 Bogotá,     90 day retention (var)
#   - Monthly : 1st 03:00 Bogotá,         365 day retention (var)
#
# The vault is encrypted with KMS managed key (aws/backup by default).
# The IAM role uses AWS Backup managed policies.
# ─────────────────────────────────────────────────────────────────────────

# ─── Backup Vault ─────────────────────────────────────────────────────────
resource "aws_backup_vault" "this" {
  name        = "${var.name_prefix}-db-vault"
  kms_key_arn = var.vault_kms_key_arn  # null = aws/backup managed key

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-db-vault"
    Component = "backup"
  })
}

# ─── IAM role that AWS Backup will use to take snapshots ─────────────────
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

# ─── Plan with three rules ────────────────────────────────────────────────
resource "aws_backup_plan" "this" {
  name = "${var.name_prefix}-db-backup-plan"

  # ── Daily: 03:00 Bogotá (08:00 UTC) ─────────────────────────────────
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

  # ── Weekly: Sundays 08:00 UTC ───────────────────────────────────────
  rule {
    rule_name         = "weekly-sunday"
    target_vault_name = aws_backup_vault.this.name
    schedule          = "cron(0 8 ? * 1 *)"

    lifecycle {
      delete_after = var.weekly_retention_days
    }
  }

  # ── Monthly: 1st of each month 08:00 UTC ─────────────────────────────
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

# ─── Selection: targets the RDS instance by ARN ───────────────────────────
resource "aws_backup_selection" "rds" {
  name         = "${var.name_prefix}-rds-selection"
  plan_id      = aws_backup_plan.this.id
  iam_role_arn = aws_iam_role.backup.arn

  resources = [var.db_instance_arn]
}
