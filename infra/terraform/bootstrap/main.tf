# ─────────────────────────────────────────────────────────────────────────
# Bootstrap — crea el bucket S3 que guarda el state remoto del resto de
# configuraciones de este repo.
#
# Este módulo usa state LOCAL (terraform.tfstate aquí) porque está creando
# el backend. Aplícalo UNA vez; después los environments lo usan como
# backend con `use_lockfile = true` (Terraform 1.10+ — sin DynamoDB).
#
# Free Tier:
#   - S3: 5 GB + 20k GET + 2k PUT/mes gratis durante 12 meses.
#   - State < 1 MB. Cómodamente gratis.
#   - Sin DynamoDB gracias a use_lockfile.
# ─────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "tfstate" {
  bucket = var.state_bucket_name

  # Seguridad: no permitir que `terraform destroy` borre el historial.
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
