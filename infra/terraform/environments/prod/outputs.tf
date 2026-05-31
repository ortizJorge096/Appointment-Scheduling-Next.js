output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "github_actions_role_arn" {
  description = "AWS_ROLE_ARN para el GitHub Environment `production`."
  value       = module.github_oidc.role_arn
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

output "db_endpoint" {
  value = module.rds.db_endpoint
}

output "database_url_ssm_parameter" {
  value = module.rds.database_url_ssm_parameter
}

output "assets_bucket_name" {
  value = module.s3_assets.bucket_name
}

output "assets_public_base_url" {
  value = module.s3_assets.public_base_url
}

output "app_public_ip" {
  value = var.enable_ec2_k3s ? module.k3s[0].public_ip : null
}

output "asg_name" {
  value = var.enable_ec2_k3s ? module.k3s[0].asg_name : null
}

output "app_url" {
  value = var.enable_ec2_k3s ? module.k3s[0].app_url : null
}

output "app_url_https" {
  value = var.enable_ec2_k3s ? module.k3s[0].app_url_https : null
}

output "letsencrypt_host" {
  value = var.enable_ec2_k3s ? module.k3s[0].letsencrypt_host : null
}

output "health_url" {
  value = var.enable_ec2_k3s ? module.k3s[0].health_url : null
}

output "ssm_session_command" {
  value = var.enable_ec2_k3s ? module.k3s[0].ssm_session_command : null
}

output "monitoring_sns_topic_arn" {
  value = (var.enable_ec2_k3s && var.enable_monitoring) ? module.monitoring[0].sns_topic_arn : null
}

output "monitoring_alarms" {
  value = (var.enable_ec2_k3s && var.enable_monitoring) ? module.monitoring[0].alarm_names : []
}
