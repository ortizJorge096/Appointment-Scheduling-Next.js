# ─────────────────────────────────────────────────────────────────────────
# Bootstrap — creates the S3 bucket that stores the remote state for the
# rest of the configurations in this repo.
#
# This module uses LOCAL state (terraform.tfstate here) because it is creating
# the backend. Apply it ONCE; afterwards the environments use it as
# backend with `use_lockfile = true` (Terraform 1.10+ — no DynamoDB).
#
# Free Tier:
#   - S3: 5 GB + 20k GET + 2k PUT/month free for 12 months.
#   - State < 1 MB. Comfortably free.
#   - No DynamoDB thanks to use_lockfile.
# ─────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "tfstate" {
  bucket = var.state_bucket_name

  # Security: prevent `terraform destroy` from deleting history.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
