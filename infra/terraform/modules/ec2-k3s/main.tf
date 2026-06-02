# ─────────────────────────────────────────────────────────────────────────
# Nodo k3s sobre EC2 — ASG con Spot + on-demand fallback + EIP persistente.
#
# Adaptado para Next.js + Prisma:
#   - Instance profile suma permisos para LEER SSM (DATABASE_URL y
#     NEXTAUTH_SECRET) y para los servicios AWS que la app usa (S3 + SES,
#     vía extra_managed_policy_arns).
#   - User-data inyecta esos valores al Secret de Kubernetes ANTES de
#     aplicar el overlay, así el init container de prisma migrate ya tiene
#     la DATABASE_URL al arrancar.
# ─────────────────────────────────────────────────────────────────────────

data "aws_partition" "current" {}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ─── Security Group ──────────────────────────────────────────────────────
resource "aws_security_group" "this" {
  name        = "${var.name}-sg"
  description = "k3s node: HTTP/HTTPS, sin SSH (acceso via SSM Session Manager)"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP (traefik)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS (traefik)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound (ECR, SSM, RDS, S3, SES, CloudWatch, GitHub, dnf)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name}-sg" })
}

# ─── IAM ──────────────────────────────────────────────────────────────────
data "aws_iam_policy_document" "ec2_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name               = "${var.name}-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cw_agent" {
  count      = var.cloudwatch_agent_config ? 1 : 0
  role       = aws_iam_role.node.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Permisos extra (S3 gallery + SES) vienen del environment.
resource "aws_iam_role_policy_attachment" "extra" {
  count      = length(var.extra_managed_policy_arns)
  role       = aws_iam_role.node.name
  policy_arn = var.extra_managed_policy_arns[count.index]
}

# Lectura de los SSM SecureString que tienen DATABASE_URL y NEXTAUTH_SECRET.
data "aws_iam_policy_document" "ssm_read_secrets" {
  statement {
    sid    = "ReadAppSecrets"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.database_url_ssm_parameter}",
      "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.nextauth_secret_ssm_parameter}",
    ]
  }
  # KMS decrypt para SSM SecureString (key default de AWS managed key alias/aws/ssm)
  statement {
    sid       = "KmsDecryptAwsSsm"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "ssm_read_secrets" {
  name   = "${var.name}-ssm-read-secrets"
  role   = aws_iam_role.node.id
  policy = data.aws_iam_policy_document.ssm_read_secrets.json
}

# EIP re-associate permission (mismo razonamiento que la referencia).
data "aws_iam_policy_document" "eip_associate" {
  statement {
    sid       = "DescribeAddresses"
    effect    = "Allow"
    actions   = ["ec2:DescribeAddresses"]
    resources = ["*"]
  }
  statement {
    sid       = "AssociateOurEip"
    effect    = "Allow"
    actions   = ["ec2:AssociateAddress", "ec2:DisassociateAddress"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "eip_associate" {
  name   = "${var.name}-eip-associate"
  role   = aws_iam_role.node.id
  policy = data.aws_iam_policy_document.eip_associate.json
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.name}-profile"
  role = aws_iam_role.node.name
  tags = var.tags
}

# ─── Elastic IP persistente ──────────────────────────────────────────────
resource "aws_eip" "this" {
  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.name}-eip" })
}

# ─── User-data ────────────────────────────────────────────────────────────
locals {
  effective_public_host = var.public_host != "" ? var.public_host : "${var.public_host_prefix}.${replace(aws_eip.this.public_ip, ".", "-")}.nip.io"

  userdata = templatefile("${path.module}/userdata.sh.tftpl", {
    github_owner               = var.github_owner
    github_repo                = var.github_repo
    git_branch                 = var.git_branch
    kustomize_overlay          = var.kustomize_overlay
    kustomize_overlay_path     = var.kustomize_overlay_path
    image_ref                  = var.image_ref
    aws_region                 = var.aws_region
    public_host                = local.effective_public_host
    enable_cloudwatch_agent    = var.cloudwatch_agent_config
    enable_letsencrypt         = var.enable_letsencrypt
    letsencrypt_email          = var.letsencrypt_email
    github_token               = var.github_token
    runner_labels              = var.runner_labels
    runner_version             = var.runner_version
    eip_allocation_id          = aws_eip.this.allocation_id
    app_namespace              = var.app_namespace
    database_url_ssm_parameter = var.database_url_ssm_parameter
    nextauth_secret_ssm_parameter = var.nextauth_secret_ssm_parameter
    s3_bucket_name             = var.s3_bucket_name
    ses_from_email             = var.ses_from_email
    enable_emails              = var.enable_emails
  })
}

# ─── Launch Template ──────────────────────────────────────────────────────
resource "aws_launch_template" "this" {
  name_prefix   = "${var.name}-lt-"
  image_id      = var.ami_id != "" ? var.ami_id : data.aws_ami.al2023.id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.node.name
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.this.id]
    delete_on_termination       = true
  }

  metadata_options {
    http_tokens                 = "required"
    http_endpoint               = "enabled"
    http_put_response_hop_limit = 2
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type           = "gp3"
      volume_size           = 20
      encrypted             = true
      delete_on_termination = true
    }
  }

  user_data = base64encode(local.userdata)

  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, { Name = var.name })
  }
  tag_specifications {
    resource_type = "volume"
    tags          = merge(var.tags, { Name = "${var.name}-root" })
  }
  tag_specifications {
    resource_type = "network-interface"
    tags          = merge(var.tags, { Name = "${var.name}-eni" })
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = "${var.name}-lt" })
}

# ─── Auto Scaling Group ───────────────────────────────────────────────────
resource "aws_autoscaling_group" "this" {
  name                      = var.name
  min_size                  = 1
  max_size                  = 1
  desired_capacity          = 1
  vpc_zone_identifier       = [var.subnet_id]
  health_check_type         = "EC2"
  health_check_grace_period = 300
  default_cooldown          = 60

  capacity_rebalance = true

  termination_policies = ["OldestInstance"]

  wait_for_capacity_timeout = "10m"

  mixed_instances_policy {
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.this.id
        version            = "$Latest"
      }

      dynamic "override" {
        for_each = var.spot_instance_types
        content {
          instance_type = override.value
        }
      }
    }

    instances_distribution {
      on_demand_base_capacity                  = var.on_demand_base_capacity
      on_demand_percentage_above_base_capacity = var.on_demand_percentage_above_base_capacity
      on_demand_allocation_strategy            = "lowest-price"
      spot_allocation_strategy                 = "price-capacity-optimized"
    }
  }

  dynamic "tag" {
    for_each = merge(var.tags, { Name = var.name })
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  timeouts {
    delete = "15m"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 0
      instance_warmup        = 300
    }
    triggers = ["tag"]
  }

  lifecycle {
    ignore_changes = [desired_capacity]
  }
}
