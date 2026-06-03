output "db_endpoint" {
  description = "Endpoint host:puerto de la instancia."
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "Host de la instancia (sin puerto)."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Puerto."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Nombre de la BD inicial."
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Usuario master."
  value       = var.db_username
}

output "db_security_group_id" {
  description = "SG de la BD."
  value       = aws_security_group.db.id
}

output "database_url_ssm_parameter" {
  description = "Path en SSM Parameter Store donde vive la DATABASE_URL (SecureString)."
  value       = aws_ssm_parameter.database_url.name
}

output "db_password_ssm_parameter" {
  description = "Path en SSM del password master (SecureString)."
  value       = aws_ssm_parameter.db_password.name
}

output "db_instance_identifier" {
  description = "Identifier de la instancia RDS — para usar con el módulo rds-scheduler."
  value       = aws_db_instance.this.identifier
}

output "db_instance_arn" {
  description = "ARN de la instancia RDS — para políticas IAM del rds-scheduler."
  value       = aws_db_instance.this.arn
}
