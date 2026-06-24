# ─────────────────────────────────────────────────────────────────────────
# Network — VPC with 2 public subnets (different AZs) + 2 private
# subnets for RDS.
#
# Topology:
#   - 1 VPC (10.0.0.0/16)
#   - 2 public subnets (10.0.0.0/24, 10.0.1.0/24) — k3s + EIP
#   - 2 private DB subnets (10.0.10.0/24, 10.0.11.0/24) — RDS subnet group
#   - 1 Internet Gateway
#   - 1 public route table associated with the public subnets
#   - NO NAT Gateway: RDS does not need Internet access; k3s lives in public.
#
# What we do NOT include (to keep Free Tier):
#   - NAT Gateway: ~$32/mo + transfer.
#   - VPC Flow Logs: $0.50/GB ingested into CloudWatch.
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

# ─── Public subnets (k3s) ─────────────────────────────────────────────────
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

# ─── Private DB subnets (RDS subnet group) ────────────────────────────────
# No Internet route. The RDS subnet group requires >= 2 AZs, so
# we provide two even though we only use one for the instance (single-AZ).
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

# Default SG: empty (best practice).
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.name}-default-sg-locked"
  })
}
