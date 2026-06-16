terraform {
  # Replace `bucket` with the `state_bucket_name` output from bootstrap.
  # Native S3 locking (Terraform >= 1.10) — no DynamoDB.
  backend "s3" {
    bucket       = "appointment-scheduling-tfstate"
    key          = "dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
