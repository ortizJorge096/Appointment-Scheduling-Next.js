variable "name" {
  description = "Prefix for naming resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC where the DB security group is created."
  type        = string
}

variable "db_subnet_ids" {
  description = "List of private subnet IDs for the RDS subnet group (min. 2 AZs)."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "SGs allowed to connect to Postgres (5432). Typically the k3s one."
  type        = list(string)
  default     = []
}

variable "allowed_cidr_blocks" {
  description = <<-EOT
    CIDRs allowed to connect to Postgres (5432) — only meaningful when
    publicly_accessible = true (cross-account / operator access). Keep these as
    tight /32s (a single IP each), never a wide range. Empty = SG-only ingress.
  EOT
  type        = list(string)
  default     = []

  validation {
    # Public Postgres exposure must be per-IP (ADR-013): reject anything wider.
    condition     = alltrue([for c in var.allowed_cidr_blocks : endswith(c, "/32")])
    error_message = "allowed_cidr_blocks must be single-host /32 CIDRs, never a range."
  }
}

variable "engine_version" {
  description = "Postgres version."
  type        = string
  default     = "16.4"
}

variable "instance_class" {
  description = "RDS instance class. db.t3.micro / db.t4g.micro are Free Tier."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage_gb" {
  description = "Storage in GB. Free Tier offers 20 GB."
  type        = number
  default     = 20
}

variable "max_allocated_storage_gb" {
  description = "Storage autoscaling up to this limit (0 = disables autoscaling)."
  type        = number
  default     = 0
}

variable "storage_type" {
  description = "gp2 or gp3. gp2 is covered by Free Tier."
  type        = string
  default     = "gp2"
}

variable "db_name" {
  description = "Name of the initial database."
  type        = string
  default     = "appointment_scheduling"
}

variable "db_username" {
  description = "Master username."
  type        = string
  default     = "appsched"
}

variable "backup_retention_days" {
  description = "Backup retention days. 0 disables automated backups."
  type        = number
  default     = 0
}

variable "backup_window" {
  description = "Preferred backup window (UTC). Only effective when backup_retention_days > 0."
  type        = string
  default     = "06:00-07:00"
}

variable "deletion_protection" {
  description = "Block accidental destroy. Set to true for prod."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on destroy (true facilitates dev tear-down)."
  type        = bool
  default     = true
}

variable "publicly_accessible" {
  description = "Whether the DB accepts connections from the Internet. Keep it false."
  type        = bool
  default     = false
}

variable "multi_az" {
  description = "Multi-AZ replication. false saves cost (not Free Tier for Multi-AZ)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
