variable "name_prefix" {
  description = "Prefijo para nombrar los recursos (ej: appointment-scheduling-dev)."
  type        = string
}

variable "db_instance_identifier" {
  description = "Identifier de la instancia RDS (aws_db_instance.this.identifier)."
  type        = string
}

variable "db_instance_arn" {
  description = "ARN de la instancia RDS para la política IAM."
  type        = string
}

variable "tags" {
  description = "Tags aplicados a todos los recursos del módulo."
  type        = map(string)
  default     = {}
}
