output "send_policy_arn" {
  description = "ARN of the IAM policy for sending emails via SES."
  value       = aws_iam_policy.ses_send.arn
}
