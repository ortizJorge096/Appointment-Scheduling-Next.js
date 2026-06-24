variable "repository_name" {
  description = "Nombre del repositorio ECR."
  type        = string
}

variable "image_tag_mutability" {
  description = "Tag mutability. MUTABLE permite reescribir tags como `latest`."
  type        = string
  default     = "MUTABLE"
  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "Debe ser MUTABLE o IMMUTABLE."
  }
}

variable "scan_on_push" {
  description = "Escanear imágenes con el scanner básico de ECR al subir."
  type        = bool
  default     = true
}

variable "max_image_count" {
  description = "Cantidad máxima de imágenes tagged que se conservan."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
