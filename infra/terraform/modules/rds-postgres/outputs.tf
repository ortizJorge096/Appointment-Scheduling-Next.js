output "db_endpoint" {
  description = "Endpoint host:port of the instance."
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "Host of the instance (without port)."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Port."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Name of the initial DB."
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Master username."
  value       = var.db_username
}

output "db_security_group_id" {
  description = "Security group of the DB."
  value       = aws_security_group.db.id
}

output "database_url_ssm_parameter" {
  description = "Path in SSM Parameter Store where DATABASE_URL lives (SecureString)."
  value       = aws_ssm_parameter.database_url.name
}

output "db_password_ssm_parameter" {
  description = "Path in SSM of the master password (SecureString)."
  value       = aws_ssm_parameter.db_password.name
}

output "db_instance_identifier" {
  description = "Identifier of the RDS instance — for use with the rds-scheduler module."
  value       = aws_db_instance.this.identifier
}

output "db_instance_arn" {
  description = "ARN of the RDS instance — for rds-scheduler IAM policies."
  value       = aws_db_instance.this.arn
}
