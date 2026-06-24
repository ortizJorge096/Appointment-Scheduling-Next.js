# ─────────────────────────────────────────────────────────────────────────
# Monitoring — CloudWatch alarms + SNS topic for email alerts.
#
# Alarms use the `AutoScalingGroupName` dimension (not `InstanceId`)
# so they SURVIVE instance replacement due to Spot reclaim — the ASG
# rotates the EC2 but the ASG name is stable.
#
# Free Tier:
#   - CloudWatch alarms: 10 free/month (we create 3-4).
#   - SNS: 1M free publications, free email subscriptions.
#   - CW Agent custom metrics: each metric counts as custom (~$0.30/mo
#     each after the free tier of 5).
# ─────────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
  # AWS sends a confirmation email; you must click the link.
}

# ─── CPU ──────────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = var.cpu_threshold_percent
  alarm_description   = "CPU > ${var.cpu_threshold_percent}% for 3 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    AutoScalingGroupName = var.asg_name
  }

  tags = var.tags
}

# ─── Memoria (requiere CW Agent) ──────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "memory_high" {
  count               = var.enable_memory_disk_alarms ? 1 : 0
  alarm_name          = "${var.name}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "mem_used_percent"
  namespace           = "AppointmentScheduling/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = var.memory_threshold_percent
  alarm_description   = "Memory > ${var.memory_threshold_percent}% for 3 minutes"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    AutoScalingGroupName = var.asg_name
  }

  tags = var.tags
}

# ─── Disco (requiere CW Agent) ────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "disk_high" {
  count               = var.enable_memory_disk_alarms ? 1 : 0
  alarm_name          = "${var.name}-disk-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "disk_used_percent"
  namespace           = "AppointmentScheduling/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = var.disk_threshold_percent
  alarm_description   = "Disk usage / > ${var.disk_threshold_percent}%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    AutoScalingGroupName = var.asg_name
  }

  tags = var.tags
}

# ─── System status check (will transition on Spot reclaim) ────────────────
resource "aws_cloudwatch_metric_alarm" "status_check_failed" {
  alarm_name          = "${var.name}-status-check-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "EC2 system status check failed — ASG will replace the instance."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    AutoScalingGroupName = var.asg_name
  }

  tags = var.tags
}
