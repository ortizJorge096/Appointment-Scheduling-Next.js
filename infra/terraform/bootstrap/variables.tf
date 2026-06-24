variable "region" {
  description = "Región AWS para el bucket de state. Pick uno con Free Tier."
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = <<-EOT
    Nombre globalmente único del bucket S3 para state remoto.
    Sugerencia: "appointment-scheduling-tfstate".
  EOT
  type        = string
}
