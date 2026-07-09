variable "name_prefix" {
  description = "Prefix for naming resources (e.g.: appointment-scheduling-dev)."
  type        = string
}

variable "asg_name" {
  description = "Name of the Auto Scaling Group to scale to zero."
  type        = string
}

variable "asg_arn" {
  description = "ARN of the Auto Scaling Group for the IAM policy."
  type        = string
}

variable "stop_schedule" {
  description = "EventBridge Scheduler cron to SCALE DOWN the ASG (desired_capacity=0). Default: daily 22:00 Bogota."
  type        = string
  default     = "cron(0 22 * * ? *)"
}

variable "start_schedule" {
  description = "Cron to SCALE UP the ASG (desired_capacity=1). Empty = no automatic start (start manually)."
  type        = string
  default     = "cron(0 8 * * ? *)"
}

variable "schedule_timezone" {
  description = "Timezone for the schedules (e.g. America/Bogota)."
  type        = string
  default     = "America/Bogota"
}

variable "tags" {
  description = "Tags applied to all resources in the module."
  type        = map(string)
  default     = {}
}
