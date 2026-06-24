output "sns_topic_arn" {
  description = "ARN of the SNS topic that receives notifications."
  value       = aws_sns_topic.alarms.arn
}

output "alarm_names" {
  description = "Names of the created alarms."
  value = compact([
    aws_cloudwatch_metric_alarm.cpu_high.alarm_name,
    aws_cloudwatch_metric_alarm.status_check_failed.alarm_name,
    var.enable_memory_disk_alarms ? aws_cloudwatch_metric_alarm.memory_high[0].alarm_name : "",
    var.enable_memory_disk_alarms ? aws_cloudwatch_metric_alarm.disk_high[0].alarm_name : "",
  ])
}
