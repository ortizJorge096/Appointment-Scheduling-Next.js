output "sns_topic_arn" {
  description = "ARN del tópico SNS que recibe las notificaciones."
  value       = aws_sns_topic.alarms.arn
}

output "alarm_names" {
  description = "Nombres de las alarmas creadas."
  value = compact([
    aws_cloudwatch_metric_alarm.cpu_high.alarm_name,
    aws_cloudwatch_metric_alarm.status_check_failed.alarm_name,
    var.enable_memory_disk_alarms ? aws_cloudwatch_metric_alarm.memory_high[0].alarm_name : "",
    var.enable_memory_disk_alarms ? aws_cloudwatch_metric_alarm.disk_high[0].alarm_name : "",
  ])
}
