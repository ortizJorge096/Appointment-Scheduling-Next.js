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

variable "stop_schedule" {
  description = "EventBridge Scheduler cron for STOPPING the DB. Default: every hour."
  type        = string
  default     = "cron(0 * * * ? *)"
}

variable "start_schedule" {
  description = "Cron for STARTING the DB. Empty = no automatic start (start manually)."
  type        = string
  default     = ""
}

variable "schedule_timezone" {
  description = "Timezone for the schedules (e.g. America/Bogota). Default UTC."
  type        = string
  default     = "UTC"
}

variable "tags" {
  description = "Tags applied to all resources in the module."
  type        = map(string)
  default     = {}
}
