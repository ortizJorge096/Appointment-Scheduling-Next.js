# ─────────────────────────────────────────────────────────────────────────
# Monitoring — alarmas CloudWatch + tópico SNS para alertas por email.
#
# Las alarmas usan la dimensión `AutoScalingGroupName` (no `InstanceId`)
# para que SOBREVIVAN al reemplazo de instancia por Spot reclaim — el ASG
# rota la EC2 pero el nombre del ASG es estable.
#
# Free Tier:
#   - CloudWatch alarms: 10 free/mes (creamos 3-4).
#   - SNS: 1M publicaciones gratis, suscripciones email gratis.
#   - CW Agent custom metrics: cuenta cada métrica como custom (~$0.30/mo
#     cada una después del free tier de 5).
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
  # AWS envía un email de confirmación; hay que hacer clic en el enlace.
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
  alarm_description   = "CPU > ${var.cpu_threshold_percent}% durante 3 minutos"
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
  alarm_description   = "Memoria > ${var.memory_threshold_percent}% durante 3 minutos"
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
  alarm_description   = "Uso de disco / > ${var.disk_threshold_percent}%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    AutoScalingGroupName = var.asg_name
  }

  tags = var.tags
}

# ─── Status check del sistema (transitará en Spot reclaim) ────────────────
resource "aws_cloudwatch_metric_alarm" "status_check_failed" {
  alarm_name          = "${var.name}-status-check-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Status check del sistema EC2 falló — el ASG va a reemplazar la instancia."
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]

  dimensions = {
    AutoScalingGroupName = var.asg_name
  }

  tags = var.tags
}
