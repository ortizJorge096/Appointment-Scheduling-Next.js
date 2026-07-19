# ─────────────────────────────────────────────────────────────────────────
# prod-db-freetier — a standalone, publicly-accessible PROD Postgres in a SEPARATE
# free-tier AWS account (ADR-013). Reuses the rds-postgres module, with its OWN
# state and credentials (var.aws_profile) — deliberately NOT wired into the main
# env, so the two accounts never share state or blast radius.
#
# The cluster stays in the main account and reaches this DB over the internet, so
# access is public but locked to two /32s (operator + cluster EIP) with SSL forced
# by the module's parameter group. This DB holds real client + payment PII — the
# public exposure is an ACCEPTED, documented trade-off (ADR-013), not a default.
# After `apply`, read the connection string from THIS account's SSM and feed it to
# the main env's `external_database_url`.
# ─────────────────────────────────────────────────────────────────────────

# Free-tier accounts ship a default VPC with public subnets in every AZ — enough
# for a public RDS subnet group without standing up a network module.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

module "rds" {
  source = "../../modules/rds-postgres"

  name          = var.name
  vpc_id        = data.aws_vpc.default.id
  db_subnet_ids = data.aws_subnets.default.ids

  # Cross-account: there's no cluster SG in this account, so reachability is by
  # /32 CIDR over the internet (the module enforces /32). SSL stays mandatory.
  allowed_security_group_ids = []
  allowed_cidr_blocks        = [var.operator_ip_cidr, var.cluster_eip_cidr]
  publicly_accessible        = true

  engine_version       = var.engine_version
  instance_class       = "db.t3.micro"
  allocated_storage_gb = 20
  storage_type         = "gp3"

  db_name     = "appointment_scheduling"
  db_username = "appsched"

  # PROD-grade on the new DB (ADR-013): protected from accidental destroy and a
  # final snapshot on teardown. NOTE: the new AWS Free Tier PLAN caps automated
  # backup retention — 7 is rejected (FreeTierRestrictionError). 1 = minimal PITR
  # (matches the main-account prod). If the plan disallows backups entirely, the
  # re-apply errors the same way → drop to 0 (and accept no PITR on this DB).
  backup_retention_days = 1
  deletion_protection   = true
  skip_final_snapshot   = false
  multi_az              = false

  tags = { Component = "database" }
}
