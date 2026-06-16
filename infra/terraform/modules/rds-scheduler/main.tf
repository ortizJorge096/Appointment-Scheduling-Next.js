# ─────────────────────────────────────────────────────────────────────────
# rds-scheduler — shuts down the RDS instance every hour.
#
# Use it in dev to minimize RDS cost.
# When you need the DB, start it manually and it will shut down in < 1h.
# Do NOT use this module in prod.
#
# AWS ignores StopDBInstance if the instance is already stopped — no errors.
# Note: AWS RDS automatically restarts after 7 days stopped — AWS behavior.
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

# Shut down hourly — if already stopped, AWS does nothing
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
