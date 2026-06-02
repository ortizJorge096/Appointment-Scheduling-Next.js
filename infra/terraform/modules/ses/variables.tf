variable "name_prefix" {
  description = "Prefijo para el nombre de la policy (ej: appointment-scheduling-dev)."
  type        = string
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
