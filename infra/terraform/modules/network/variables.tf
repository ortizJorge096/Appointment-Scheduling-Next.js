variable "name" {
  description = "Prefix for naming resources."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs for the public subnets (one per AZ)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "availability_zones" {
  description = "AZs where public subnets will be created."
  type        = list(string)
}

# The DB subnets are used by the RDS subnet group — they stay private
# (no Internet route) and are only accessible from the k3s SG.
variable "db_subnet_cidrs" {
  description = "CIDRs for the private subnets used by RDS."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "tags" {
  description = "Additional tags."
  type        = map(string)
  default     = {}
}
