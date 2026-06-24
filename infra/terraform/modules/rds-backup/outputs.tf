output "vault_arn" {
  description = "ARN del vault de backups."
  value       = aws_backup_vault.this.arn
}

output "vault_name" {
  description = "Nombre del vault."
  value       = aws_backup_vault.this.name
}

output "backup_plan_id" {
  description = "ID del plan de AWS Backup."
  value       = aws_backup_plan.this.id
}

output "backup_role_arn" {
  description = "ARN del IAM role usado por AWS Backup."
  value       = aws_iam_role.backup.arn
}
