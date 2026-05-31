variable "github_owner" {
  description = "Owner del repo en GitHub (usuario u organización)."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repo en GitHub."
  type        = string
}

variable "allowed_branches" {
  description = "Branches autorizadas a asumir el rol vía OIDC (push events)."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "allowed_environments" {
  description = "GitHub Environments autorizados (deploy job)."
  type        = list(string)
  default     = ["dev", "production"]
}

variable "ecr_repository_arn" {
  description = "ARN del repo ECR sobre el que el rol puede push/pull."
  type        = string
}

variable "role_name" {
  description = "Nombre del IAM role para GitHub Actions."
  type        = string
}

variable "create_oidc_provider" {
  description = "Crear el OIDC provider en IAM. Solo uno por cuenta; el primer environment lo crea, el segundo lo reusa."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
