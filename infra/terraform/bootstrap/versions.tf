terraform {
  # >= 1.10 unlocks native S3 locking (use_lockfile = true),
  # so we do not need DynamoDB and stay within Free Tier.
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project     = "appointment-scheduling"
      Environment = "shared"
      ManagedBy   = "terraform"
      Component   = "bootstrap"
    }
  }
}
