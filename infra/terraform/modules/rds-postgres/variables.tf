variable "name" {
  description = "Prefijo para nombrar recursos."
  type        = string
}

variable "vpc_id" {
  description = "VPC donde se crea el SG de la BD."
  type        = string
}

variable "db_subnet_ids" {
  description = "Lista de subnet IDs privadas para el subnet group de RDS (mín. 2 AZs)."
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "SGs que pueden conectarse a Postgres (5432). Típicamente el del k3s."
  type        = list(string)
  default     = []
}

variable "engine_version" {
  description = "Versión de Postgres."
  type        = string
  default     = "16.4"
}

variable "instance_class" {
  description = "Instance class de RDS. db.t3.micro / db.t4g.micro son Free Tier."
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage_gb" {
  description = "Storage en GB. Free Tier ofrece 20 GB."
  type        = number
  default     = 20
}

variable "max_allocated_storage_gb" {
  description = "Autoscaling de storage hasta este tope (0 = desactiva autoscaling)."
  type        = number
  default     = 0
}

variable "storage_type" {
  description = "gp2 o gp3. gp2 cubre Free Tier."
  type        = string
  default     = "gp2"
}

variable "db_name" {
  description = "Nombre de la BD inicial."
  type        = string
  default     = "appointment_scheduling"
}

variable "db_username" {
  description = "Usuario master."
  type        = string
  default     = "appsched"
}

variable "backup_retention_days" {
  description = "Días de retención de backups. 7 es el default sensato; 0 los desactiva."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Bloquear destroy accidental. Pónlo en true para prod."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Saltar snapshot final al destruir (true facilita dev tear-down)."
  type        = bool
  default     = true
}

variable "publicly_accessible" {
  description = "Si la BD acepta conexiones desde Internet. Mantenerlo en false."
  type        = bool
  default     = false
}

variable "multi_az" {
  description = "Multi-AZ replication. false ahorra costo (no Free Tier para Multi-AZ)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
