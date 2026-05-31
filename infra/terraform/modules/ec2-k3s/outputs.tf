output "instance_role_name" {
  description = "Nombre del IAM role del nodo (para attach desde el environment)."
  value       = aws_iam_role.node.name
}

output "instance_role_arn" {
  description = "ARN del role del nodo."
  value       = aws_iam_role.node.arn
}

output "instance_profile_name" {
  description = "Nombre del instance profile."
  value       = aws_iam_instance_profile.node.name
}

output "instance_security_group_id" {
  description = "ID del SG del nodo (úsalo en allowed_security_group_ids de RDS)."
  value       = aws_security_group.this.id
}

output "public_ip" {
  description = "Elastic IP."
  value       = aws_eip.this.public_ip
}

output "letsencrypt_host" {
  description = "FQDN nip.io que se usa como SAN del certificado."
  value       = local.effective_public_host
}

output "app_url" {
  description = "URL HTTP pública."
  value       = "http://${local.effective_public_host}"
}

output "app_url_https" {
  description = "URL HTTPS pública (solo si enable_letsencrypt)."
  value       = "https://${local.effective_public_host}"
}

output "health_url" {
  description = "Endpoint de health."
  value       = "http://${local.effective_public_host}/api/health"
}

output "asg_name" {
  description = "Nombre del ASG."
  value       = aws_autoscaling_group.this.name
}

output "ssm_session_command" {
  description = "Comando para abrir una shell vía SSM Session Manager."
  value       = "aws ssm start-session --region ${var.aws_region} --target $(aws ec2 describe-instances --region ${var.aws_region} --filters 'Name=tag:aws:autoscaling:groupName,Values=${aws_autoscaling_group.this.name}' 'Name=instance-state-name,Values=running' --query 'Reservations[0].Instances[0].InstanceId' --output text)"
}
