output "instance_role_name" {
  description = "Name of the node IAM role (for attaching from the environment)."
  value       = aws_iam_role.node.name
}

output "instance_role_arn" {
  description = "ARN of the node role."
  value       = aws_iam_role.node.arn
}

output "instance_profile_name" {
  description = "Name of the instance profile."
  value       = aws_iam_instance_profile.node.name
}

output "instance_security_group_id" {
  description = "ID of the node SG (use it in allowed_security_group_ids of RDS)."
  value       = aws_security_group.this.id
}

output "public_ip" {
  description = "Elastic IP."
  value       = aws_eip.this.public_ip
}

output "letsencrypt_host" {
  description = "nip.io FQDN used as the certificate SAN."
  value       = local.effective_public_host
}

output "app_url" {
  description = "Public HTTP URL."
  value       = "http://${local.effective_public_host}"
}

output "app_url_https" {
  description = "Public HTTPS URL (only if enable_letsencrypt)."
  value       = "https://${local.effective_public_host}"
}

output "health_url" {
  description = "Health endpoint."
  value       = "http://${local.effective_public_host}/api/health"
}

output "asg_name" {
  description = "Name of the ASG."
  value       = aws_autoscaling_group.this.name
}

output "ssm_session_command" {
  description = "Command to open a shell via SSM Session Manager."
  value       = "aws ssm start-session --region ${var.aws_region} --target $(aws ec2 describe-instances --region ${var.aws_region} --filters 'Name=tag:aws:autoscaling:groupName,Values=${aws_autoscaling_group.this.name}' 'Name=instance-state-name,Values=running' --query 'Reservations[0].Instances[0].InstanceId' --output text)"
}
