output "role_arn" {
  description = "ARN del rol que GitHub Actions asume vía OIDC."
  value       = aws_iam_role.github.arn
}

output "role_name" {
  description = "Nombre del rol."
  value       = aws_iam_role.github.name
}

output "oidc_provider_arn" {
  description = "ARN del OIDC provider de GitHub en IAM."
  value       = local.oidc_provider_arn
}
