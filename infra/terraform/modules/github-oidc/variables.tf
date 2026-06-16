variable "github_owner" {
  description = "Owner of the repo on GitHub (user or organization)."
  type        = string
}

variable "github_repo" {
  description = "Name of the repo on GitHub."
  type        = string
}

variable "allowed_branches" {
  description = "Branches authorized to assume the role via OIDC (push events)."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "allowed_environments" {
  description = "Authorized GitHub Environments (deploy job)."
  type        = list(string)
  default     = ["dev", "production"]
}

variable "ecr_repository_arn" {
  description = "ARN of the ECR repo the role can push/pull to."
  type        = string
}

variable "role_name" {
  description = "Name of the IAM role for GitHub Actions."
  type        = string
}

variable "create_oidc_provider" {
  description = "Create the OIDC provider in IAM. Only one per account; the first environment creates it, the second reuses it."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
