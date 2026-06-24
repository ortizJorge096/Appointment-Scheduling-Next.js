output "role_arn" {
  description = "ARN of the role GitHub Actions assumes via OIDC."
  value       = aws_iam_role.github.arn
}

output "role_name" {
  description = "Name of the role."
  value       = aws_iam_role.github.name
}

output "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider in IAM."
  value       = local.oidc_provider_arn
}
