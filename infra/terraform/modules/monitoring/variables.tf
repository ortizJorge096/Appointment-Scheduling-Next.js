variable "name" {
  description = "Prefix for naming alarms and SNS topic."
  type        = string
}

variable "alarm_email" {
  description = "Email that receives notifications. If empty, no subscription is created."
  type        = string
  default     = ""
}

variable "asg_name" {
  description = "Name of the k3s Auto Scaling Group — dimension used by alarms, survives Spot reclaims."
  type        = string
}

variable "cpu_threshold_percent" {
  description = "CPU threshold for alarm (percentage)."
  type        = number
  default     = 80
}

variable "memory_threshold_percent" {
  description = "Memory threshold (percentage, CW Agent metric)."
  type        = number
  default     = 85
}

variable "disk_threshold_percent" {
  description = "Disk usage / threshold (percentage, CW Agent metric)."
  type        = number
  default     = 80
}

variable "enable_memory_disk_alarms" {
  description = "Create mem/disk alarms (require CloudWatch Agent on the EC2)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
