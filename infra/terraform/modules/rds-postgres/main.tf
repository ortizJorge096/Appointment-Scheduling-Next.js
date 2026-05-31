# ─────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL — almacén del Next.js (Prisma).
#
# Free Tier:
#   - db.t3.micro / db.t4g.micro: 750 hrs/mes durante 12 meses.
#   - 20 GB gp2 + 20 GB de backups gratis.
#   - Multi-AZ NO está cubierto por Free Tier — single-AZ por defecto.
#
# Acceso:
#   - publicly_accessible = false → solo desde dentro de la VPC.
#   - Security group acepta 5432/tcp desde los SGs que pasamos en
#     `allowed_security_group_ids` (típicamente el del k3s).
#
# Password:
#   - Generado por Terraform (random_password) y almacenado en SSM
#     Parameter Store cifrado con KMS managed key (alias/aws/ssm).
#   - El módulo ec2-k3s lo lee desde SSM en user-data y lo inyecta en el
#     Secret de Kubernetes — la app solo lee DATABASE_URL del env.
# ─────────────────────────────────────────────────────────────────────────

# Password aleatorio para el usuario master.
resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Lo guardamos como SecureString en SSM para que el ec2-k3s lo lea con su
# instance profile (sin pasarlo a archivos planos del Terraform state).
resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.name}/db/password"
  description = "Master password de RDS Postgres para ${var.name}"
  type        = "SecureString"
  value       = random_password.db.result
  tags        = var.tags

  lifecycle {
    ignore_changes = [value]
  }
}

# URL completa de conexión, lista para usar como DATABASE_URL.
resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.name}/db/url"
  description = "Connection string (DATABASE_URL) para Prisma."
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${urlencode(random_password.db.result)}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}?schema=public&sslmode=require"
  tags        = var.tags
}

# ─── Subnet group ─────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db-subnet-group"
  subnet_ids = var.db_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.name}-db-subnet-group"
  })
}

# ─── Security Group ───────────────────────────────────────────────────────
resource "aws_security_group" "db" {
  name        = "${var.name}-db-sg"
  description = "Postgres 5432 desde k3s SG"
  vpc_id      = var.vpc_id

  egress {
    description = "Sin egress (RDS responde solo a quien le habla)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name}-db-sg"
  })
}

resource "aws_security_group_rule" "allow_postgres_from_app" {
  for_each = { for id in var.allowed_security_group_ids : id => id }

  type                     = "ingress"
  description              = "Postgres desde app SG"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = each.value
  security_group_id        = aws_security_group.db.id
}

# ─── Parameter group: forzar SSL ──────────────────────────────────────────
resource "aws_db_parameter_group" "this" {
  name        = "${var.name}-pg"
  family      = "postgres${split(".", var.engine_version)[0]}"
  description = "Postgres con SSL forzado"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = var.tags
}

# ─── Instancia ────────────────────────────────────────────────────────────
resource "aws_db_instance" "this" {
  identifier        = "${var.name}-pg"
  engine            = "postgres"
  engine_version    = var.engine_version
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb > 0 ? var.max_allocated_storage_gb : null
  storage_type      = var.storage_type
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.this.name

  publicly_accessible = var.publicly_accessible
  multi_az            = var.multi_az

  backup_retention_period = var.backup_retention_days
  backup_window           = "06:00-07:00"
  maintenance_window      = "sun:07:30-sun:08:30"

  copy_tags_to_snapshot = true
  deletion_protection   = var.deletion_protection
  skip_final_snapshot   = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name}-pg-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  performance_insights_enabled = false  # No Free Tier; activa en prod si lo necesitas

  apply_immediately = false

  tags = merge(var.tags, {
    Name = "${var.name}-pg"
  })

  lifecycle {
    ignore_changes = [final_snapshot_identifier, password]
  }
}
