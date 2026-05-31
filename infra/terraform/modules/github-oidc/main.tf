# ─────────────────────────────────────────────────────────────────────────
# GitHub Actions → AWS via OIDC (sin keys de larga duración).
#
# 1) Registra el OIDC provider de GitHub (uno por cuenta, idempotente).
# 2) Crea un rol que GH Actions puede asumir SOLO desde este repo + branches.
# 3) Adjunta política de menor privilegio: push/pull en ECR + describe EC2
#    (CI necesita ubicar el instance id para mensajes informativos).
#
# Free Tier: IAM y OIDC son siempre gratis.
# ─────────────────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# AWS solo permite un OIDC provider de GitHub por cuenta. El primer
# environment en aplicarse lo crea; el segundo lo busca con data.
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # Thumbprint canónico que AWS recomienda para el provider de GitHub.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = var.tags
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

# Trust policy: solo GH Actions de este repo + branches/environments listados.
data "aws_iam_policy_document" "trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = concat(
        # Push events: sub = repo:<owner>/<repo>:ref:refs/heads/<branch>
        [
          for b in var.allowed_branches :
          "repo:${var.github_owner}/${var.github_repo}:ref:refs/heads/${b}"
        ],
        # Jobs con `environment:` declarado
        [
          for e in var.allowed_environments :
          "repo:${var.github_owner}/${var.github_repo}:environment:${e}"
        ],
        # Pull requests (sub fijo)
        ["repo:${var.github_owner}/${var.github_repo}:pull_request"]
      )
    }
  }
}

resource "aws_iam_role" "github" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.trust.json
  tags               = var.tags
}

# Permisos de menor privilegio para CI.
data "aws_iam_policy_document" "ecr" {
  statement {
    sid       = "EcrAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]  # GetAuthorizationToken no se puede limitar por recurso.
  }
  statement {
    sid    = "EcrPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:ListImages",
    ]
    resources = [var.ecr_repository_arn]
  }
  statement {
    sid    = "Ec2Describe"
    effect = "Allow"
    actions = [
      "ec2:DescribeInstances",
      "ec2:DescribeTags",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecr" {
  name   = "${var.role_name}-ecr-push"
  policy = data.aws_iam_policy_document.ecr.json
  tags   = var.tags
}

resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.github.name
  policy_arn = aws_iam_policy.ecr.arn
}
