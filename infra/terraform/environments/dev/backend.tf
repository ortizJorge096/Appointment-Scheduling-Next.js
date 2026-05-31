terraform {
  # Reemplaza `bucket` por el output `state_bucket_name` del bootstrap.
  # Locking nativo de S3 (Terraform >= 1.10) — sin DynamoDB.
  backend "s3" {
    bucket       = "appointment-scheduling-tfstate"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
