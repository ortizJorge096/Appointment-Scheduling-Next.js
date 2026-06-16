# ─────────────────────────────────────────────────────────────────────────
# ECR — primary registry for the Next.js Docker image.
#
# CI pushes via OIDC (github-oidc); k3s on EC2 pulls with the Instance
# Profile (without keys).
#
# Free Tier: 500 MB for 12 months. A Next.js standalone image +
# Prisma client ~ 300-400 MB; fits within the lifecycle policy that keeps
# only the last N tagged.
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
        description  = "Expire untagged images after 7 days"
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
        description  = "Keep only the last ${var.max_image_count} tagged"
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
