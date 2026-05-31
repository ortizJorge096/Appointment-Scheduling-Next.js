variable "name" {
  description = "Prefijo para nombrar alarmas y tópico SNS."
  type        = string
}

variable "alarm_email" {
  description = "Email que recibe notificaciones. Si está vacío, no se crea suscripción."
  type        = string
  default     = ""
}

variable "asg_name" {
  description = "Nombre del Auto Scaling Group del k3s — dimensión usada por las alarmas, sobrevive a Spot reclaims."
  type        = string
}

variable "cpu_threshold_percent" {
  description = "Umbral CPU para alarma (porcentaje)."
  type        = number
  default     = 80
}

variable "memory_threshold_percent" {
  description = "Umbral memoria (porcentaje, métrica del CW Agent)."
  type        = number
  default     = 85
}

variable "disk_threshold_percent" {
  description = "Umbral uso de disco / (porcentaje, métrica del CW Agent)."
  type        = number
  default     = 80
}

variable "enable_memory_disk_alarms" {
  description = "Crear alarmas de mem/disk (requieren CloudWatch Agent en la EC2)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
