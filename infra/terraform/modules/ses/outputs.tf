output "send_policy_arn" {
  description = "ARN de la policy IAM para enviar emails vía SES."
  value       = aws_iam_policy.ses_send.arn
}
