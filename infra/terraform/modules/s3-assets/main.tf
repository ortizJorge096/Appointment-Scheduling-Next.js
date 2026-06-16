# ─────────────────────────────────────────────────────────────────────────
# S3 assets — gallery bucket (managed from the admin).
#
# Design:
#   - Private bucket, public read ONLY on prefixes in
#     `public_prefixes` (default `gallery/`).
#   - CORS allows PUT from listed origins (admin uploads
#     directly via presigned URL issued by the server).
#   - Versioning ON by default.
#
# This module EXPOSES the IAM policy the app needs to read/write
# under public prefixes — the ec2-k3s module attaches it to the instance
# profile.
# ─────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "assets" {
  bucket = var.bucket_name
  tags = merge(var.tags, {
    Name = var.bucket_name
  })
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# We block public ACLs (legacy) but allow public policy to
# serve images via unsigned direct URL.
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

# Bucket policy — public GetObject on the listed prefixes.
data "aws_iam_policy_document" "public_read" {
  dynamic "statement" {
    for_each = var.public_prefixes
    content {
      sid    = "PublicRead${replace(replace(statement.value, "/", ""), "-", "")}"
      effect = "Allow"
      principals {
        type        = "*"
        identifiers = ["*"]
      }
      actions   = ["s3:GetObject"]
      resources = ["${aws_s3_bucket.assets.arn}/${statement.value}*"]
    }
  }
}

resource "aws_s3_bucket_policy" "assets" {
  bucket     = aws_s3_bucket.assets.id
  policy     = data.aws_iam_policy_document.public_read.json
  depends_on = [aws_s3_bucket_public_access_block.assets]
}

# CORS — admin uploads directly to S3 via presigned URL from their browser.
resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = var.allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ─── Reusable policy: the app can read/write/delete on prefixes ──────────
# The ec2-k3s module attaches this to the instance profile.
data "aws_iam_policy_document" "app_access" {
  statement {
    sid    = "GalleryReadWriteDelete"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = [
      for p in var.public_prefixes :
      "${aws_s3_bucket.assets.arn}/${p}*"
    ]
  }
  statement {
    sid    = "BucketListPrefixed"
    effect = "Allow"
    actions = ["s3:ListBucket"]
    resources = [aws_s3_bucket.assets.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = [for p in var.public_prefixes : "${p}*"]
    }
  }
}

resource "aws_iam_policy" "app_access" {
  name        = "${aws_s3_bucket.assets.id}-app-access"
  description = "App access to the assets bucket (read/write/delete on public prefixes)."
  policy      = data.aws_iam_policy_document.app_access.json
  tags        = var.tags
}
