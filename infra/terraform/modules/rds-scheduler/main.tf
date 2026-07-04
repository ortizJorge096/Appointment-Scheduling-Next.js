# ─────────────────────────────────────────────────────────────────────────
# rds-scheduler — stops (and optionally starts) the RDS instance on a schedule
# to save cost. Both schedules are parametrized per environment (cron + tz):
#   - stop_schedule  (required, defaults to hourly)
#   - start_schedule (optional; empty = no auto-start, start manually)
#   - schedule_timezone
#
# Usable in any environment. In prod, pair a nightly stop with a morning start
# so the DB is up during business hours (an online booking can't write while the
# DB is stopped). AWS ignores Stop/Start if the instance is already in that state.
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

data "aws_iam_policy_document" "rds_control" {
  statement {
    sid       = "RdsControl"
    effect    = "Allow"
    # Grant Start only when an auto-start schedule is configured.
    actions   = var.start_schedule != "" ? ["rds:StopDBInstance", "rds:StartDBInstance"] : ["rds:StopDBInstance"]
    resources = [var.db_instance_arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name_prefix}-rds-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "rds_control" {
  name   = "rds-control"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.rds_control.json
}

# Stop on the configured schedule — if already stopped, AWS does nothing.
resource "aws_scheduler_schedule" "stop" {
  name       = "${var.name_prefix}-rds-stop"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = var.stop_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })
  }
}

# Optional auto-start — only created when start_schedule is set.
resource "aws_scheduler_schedule" "start" {
  count      = var.start_schedule != "" ? 1 : 0
  name       = "${var.name_prefix}-rds-start"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = var.start_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:startDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })
  }
}
# ─────────────────────────────────────────────────────────────────────────
# rds-scheduler — stops (and optionally starts) the RDS instance on a schedule
# to save cost. Both schedules are parametrized per environment (cron + tz):
#   - stop_schedule  (required, defaults to hourly)
#   - start_schedule (optional; empty = no auto-start, start manually)
#   - schedule_timezone
#
# Usable in any environment. In prod, pair a nightly stop with a morning start
# so the DB is up during business hours (an online booking can't write while the
# DB is stopped). AWS ignores Stop/Start if the instance is already in that state.
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

data "aws_iam_policy_document" "rds_control" {
  statement {
    sid    = "RdsControl"
    effect = "Allow"
    # Grant Start only when an auto-start schedule is configured.
    actions   = var.start_schedule != "" ? ["rds:StopDBInstance", "rds:StartDBInstance"] : ["rds:StopDBInstance"]
    resources = [var.db_instance_arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name_prefix}-rds-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "rds_control" {
  name   = "rds-control"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.rds_control.json
}

# Stop on the configured schedule — if already stopped, AWS does nothing.
resource "aws_scheduler_schedule" "stop" {
  name       = "${var.name_prefix}-rds-stop"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = var.stop_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })
  }
}

# Optional auto-start — only created when start_schedule is set.
resource "aws_scheduler_schedule" "start" {
  count      = var.start_schedule != "" ? 1 : 0
  name       = "${var.name_prefix}-rds-start"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = var.start_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:startDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = var.db_instance_identifier
    })
  }
}
