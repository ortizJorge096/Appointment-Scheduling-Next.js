# ─────────────────────────────────────────────────────────────────────────
# asg-scheduler — scales the EC2 Auto Scaling Group to 0 (stop) and back
# to 1 (start) on a schedule to save compute cost outside business hours.
#
# Uses the same EventBridge Scheduler + AWS SDK pattern as rds-scheduler:
#   - stop_schedule  (required) sets MinSize=0, MaxSize=0, DesiredCapacity=0
#   - start_schedule (optional; empty = no auto-start, start manually)
#   - schedule_timezone
#
# The ASG module already has lifecycle.ignore_changes = [desired_capacity].
# This module also changes min_size and max_size, so those must be added to
# ignore_changes as well (done in ec2-k3s/main.tf).
#
# AWS ignores UpdateAutoScalingGroup if the values haven't changed —
# perfectly idempotent.
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

data "aws_iam_policy_document" "asg_control" {
  statement {
    sid    = "AsgControl"
    effect = "Allow"
    actions = [
      "autoscaling:UpdateAutoScalingGroup",
      "autoscaling:DescribeAutoScalingGroups",
    ]
    resources = [var.asg_arn]
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name_prefix}-asg-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "asg_control" {
  name   = "asg-control"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.asg_control.json
}

# Scale DOWN: set MinSize=0, MaxSize=0, DesiredCapacity=0.
# If the ASG is already at 0, AWS does nothing.
resource "aws_scheduler_schedule" "stop" {
  name       = "${var.name_prefix}-compute-stop"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = var.stop_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:autoscaling:updateAutoScalingGroup"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      AutoScalingGroupName = var.asg_name
      MinSize              = 0
      MaxSize              = 0
      DesiredCapacity      = 0
    })
  }
}

# Optional auto-start — only created when start_schedule is set.
resource "aws_scheduler_schedule" "start" {
  count      = var.start_schedule != "" ? 1 : 0
  name       = "${var.name_prefix}-compute-start"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = var.start_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:autoscaling:updateAutoScalingGroup"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      AutoScalingGroupName = var.asg_name
      MinSize              = 1
      MaxSize              = 1
      DesiredCapacity      = 1
    })
  }
}
