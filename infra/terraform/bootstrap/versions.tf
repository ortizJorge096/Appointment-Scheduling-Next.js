terraform {
  # >= 1.10 desbloquea el lock nativo de S3 (use_lockfile = true),
  # así no necesitamos DynamoDB y nos quedamos dentro de Free Tier.
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
