# ─────────────────────────────────────────────────────────────────────────
# S3 assets — bucket de la galería (gestionada desde el admin).
#
# Diseño:
#   - Bucket privado, lectura pública SOLO en los prefijos en
#     `public_prefixes` (por defecto `gallery/`).
#   - CORS permite PUT desde los orígenes listados (el admin sube
#     directo con presigned URL emitida por el server).
#   - Versioning ON por defecto.
#
# Este módulo EXPONE la policy IAM que necesita la app para leer/escribir
# bajo los prefijos públicos — el módulo ec2-k3s la adjunta al instance
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

# Bloqueamos ACLs públicas (legacy) pero permitimos policy pública para
# poder servir las imágenes vía URL directa sin firmar.
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

# Bucket policy — GetObject público en los prefijos listados.
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

# CORS — el admin sube directo a S3 vía presigned URL desde su navegador.
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

# ─── Policy reutilizable: la app puede leer/escribir/borrar en prefijos ───
# El módulo ec2-k3s adjunta esto al instance profile.
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
  description = "Acceso de la app al bucket de assets (read/write/delete en prefijos públicos)."
  policy      = data.aws_iam_policy_document.app_access.json
  tags        = var.tags
}
