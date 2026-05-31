output "bucket_name" {
  description = "Nombre del bucket."
  value       = aws_s3_bucket.assets.id
}

output "bucket_arn" {
  description = "ARN del bucket."
  value       = aws_s3_bucket.assets.arn
}

output "bucket_region" {
  description = "Región del bucket."
  value       = aws_s3_bucket.assets.region
}

output "public_base_url" {
  description = "Base URL pública nativa (sin CloudFront)."
  value       = "https://${aws_s3_bucket.assets.bucket}.s3.${aws_s3_bucket.assets.region}.amazonaws.com"
}

output "app_access_policy_arn" {
  description = "ARN de la policy que el instance profile del k3s debe adjuntar."
  value       = aws_iam_policy.app_access.arn
}
