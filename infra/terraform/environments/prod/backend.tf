terraform {
  backend "s3" {
    bucket       = "appointment-scheduling-tfstate"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
