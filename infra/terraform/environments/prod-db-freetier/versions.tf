terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # State lives in an S3 bucket in the SEPARATE free-tier account (see backend.tf),
  # NOT the main account's backend — the two accounts never share state (ADR-013).
}

provider "aws" {
  region = var.region
  # Named CLI profile for the SEPARATE free-tier account — keeps its credentials
  # and blast radius apart from the main account's Terraform.
  profile = var.aws_profile
  default_tags {
    tags = {
      Project     = "appointment-scheduling"
      Environment = "prod-db-freetier"
      ManagedBy   = "terraform"
    }
  }
}
