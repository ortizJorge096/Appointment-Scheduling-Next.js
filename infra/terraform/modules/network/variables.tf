variable "name" {
  description = "Prefijo para nombrar recursos."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR de la VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas (una por AZ)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "availability_zones" {
  description = "AZs donde crear subredes públicas."
  type        = list(string)
}

# Las subredes DB se usan por el subnet group de RDS — quedan en privado
# (sin ruta a Internet) y solo se accede desde el SG del k3s.
variable "db_subnet_cidrs" {
  description = "CIDRs de las subredes privadas para RDS."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}
