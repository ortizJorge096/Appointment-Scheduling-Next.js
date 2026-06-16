variable "name_prefix" {
  description = "Prefix for naming resources (e.g.: appointment-scheduling-dev)."
  type        = string
}

variable "db_instance_identifier" {
  description = "Identifier of the RDS instance (aws_db_instance.this.identifier)."
  type        = string
}

variable "db_instance_arn" {
  description = "ARN of the RDS instance for the IAM policy."
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources in the module."
  type        = map(string)
  default     = {}
}
