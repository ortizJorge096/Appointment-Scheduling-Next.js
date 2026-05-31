output "state_bucket_name" {
  description = "Bucket S3 que guarda el state remoto de Terraform."
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "ARN del bucket de state."
  value       = aws_s3_bucket.tfstate.arn
}

output "region" {
  description = "Región AWS del bucket de state."
  value       = var.region
}

output "backend_snippet" {
  description = "Copia esto al backend.tf de cada environment."
  value       = <<-EOT
    terraform {
      backend "s3" {
        bucket       = "${aws_s3_bucket.tfstate.bucket}"
        key          = "<env>/terraform.tfstate"
        region       = "${var.region}"
        encrypt      = true
        use_lockfile = true
      }
    }
  EOT
}
