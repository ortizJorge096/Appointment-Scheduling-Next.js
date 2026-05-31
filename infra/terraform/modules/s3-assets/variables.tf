variable "bucket_name" {
  description = "Nombre globalmente único del bucket (ej: appointment-scheduling-assets-<env>)."
  type        = string
}

variable "public_prefixes" {
  description = "Prefijos del bucket con lectura pública vía bucket policy."
  type        = list(string)
  default     = ["gallery/"]
}

variable "allowed_origins" {
  description = "Orígenes permitidos por CORS (admin sube directo desde el navegador)."
  type        = list(string)
}

variable "enable_versioning" {
  description = "Versioning en el bucket."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
