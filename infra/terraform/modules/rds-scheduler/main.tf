# ─────────────────────────────────────────────────────────────────────────
# rds-scheduler — apaga la instancia RDS cada hora.
#
# Úsalo en dev para minimizar el costo de RDS.
# Cuando necesites la BD, iníciala manualmente y se apagará sola en < 1h.
# NO uses este módulo en prod.
#
# AWS ignora StopDBInstance si la instancia ya está detenida — sin errores.
# Nota: AWS RDS se auto-reinicia tras 7 días detenido — comportamiento de AWS.
# ─────────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "rds_stop" {
  statement {
    sid       = "RdsStop"
    effect    = "Allow"
    actions   = ["rds:StopDBInstance"]
    resources = [var.db_instance_arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name_prefix}-rds-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "rds_stop" {
  name   = "rds-stop"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.rds_stop.json
}

# Apagar cada hora — si ya está detenida, AWS no hace nada
resource "aws_scheduler_schedule" "stop_hourly" {
  name       = "${var.name_prefix}-rds-stop-hourly"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 * * * ? *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })
  }
}
