# ─────────────────────────────────────────────────────────────────────────
# ECR — registro primario para la imagen Docker del Next.js.
#
# CI empuja vía OIDC (github-oidc); k3s en EC2 hace pull con el Instance
# Profile (sin keys).
#
# Free Tier: 500 MB durante 12 meses. Una imagen Next.js standalone +
# Prisma client ~ 300-400 MB; cabe con la lifecycle policy que mantiene
# solo las últimas N tagged.
# ─────────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "this" {
  name                 = var.repository_name
  image_tag_mutability = var.image_tag_mutability
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expirar imágenes sin tag tras 7 días"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Conservar solo las últimas ${var.max_image_count} tagged"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = { type = "expire" }
      }
    ]
  })
}
