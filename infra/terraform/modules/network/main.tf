# ─────────────────────────────────────────────────────────────────────────
# Network — VPC con 2 subredes públicas (AZs distintas) + 2 subredes
# privadas para RDS.
#
# Topología:
#   - 1 VPC (10.0.0.0/16)
#   - 2 subredes públicas (10.0.0.0/24, 10.0.1.0/24) — k3s + EIP
#   - 2 subredes privadas DB (10.0.10.0/24, 10.0.11.0/24) — RDS subnet group
#   - 1 Internet Gateway
#   - 1 route table pública asociada a las subredes públicas
#   - SIN NAT Gateway: RDS no necesita salir a Internet; el k3s vive en pública.
#
# Lo que NO ponemos (para mantener Free Tier):
#   - NAT Gateway: ~$32/mo + transferencia.
#   - VPC Flow Logs: $0.50/GB ingestados en CloudWatch.
# ─────────────────────────────────────────────────────────────────────────

locals {
  az_count = length(var.availability_zones)
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.name}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.name}-igw"
  })
}

# ─── Subredes públicas (k3s) ──────────────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = local.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name}-public-${var.availability_zones[count.index]}"
    Tier = "public"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(var.tags, {
    Name = "${var.name}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count          = local.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ─── Subredes privadas DB (RDS subnet group) ──────────────────────────────
# Sin route a Internet. El RDS subnet group exige >= 2 AZs, así que
# proveemos dos aunque solo usemos una para la instancia (single-AZ).
resource "aws_subnet" "db" {
  count             = local.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.db_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.name}-db-${var.availability_zones[count.index]}"
    Tier = "private-db"
  })
}

resource "aws_route_table" "db" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.name}-db-rt"
  })
}

resource "aws_route_table_association" "db" {
  count          = local.az_count
  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.db.id
}

# Default SG: vacío (best practice).
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.name}-default-sg-locked"
  })
}
