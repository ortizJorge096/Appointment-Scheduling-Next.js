output "repository_arn" {
  description = "ARN del repositorio ECR (para policies)."
  value       = aws_ecr_repository.this.arn
}

output "repository_url" {
  description = "URL del repositorio ECR (para docker push)."
  value       = aws_ecr_repository.this.repository_url
}

output "repository_name" {
  description = "Nombre del repositorio."
  value       = aws_ecr_repository.this.name
}

output "registry_id" {
  description = "ID del registro ECR (= account id)."
  value       = aws_ecr_repository.this.registry_id
}
