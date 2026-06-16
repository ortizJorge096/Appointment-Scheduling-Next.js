variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix. prod = appointment-scheduling-prod."
  type        = string
  default     = "appointment-scheduling-prod"
}

variable "github_owner" {
  type = string
}

variable "github_repo" {
  type = string
}

variable "allowed_branches" {
  type    = list(string)
  default = ["main", "develop"]
}

variable "allowed_environments" {
  type    = list(string)
  default = ["dev", "production"]
}

variable "create_oidc_provider" {
  description = "In prod defaults to false — the OIDC provider was created by dev."
  type        = bool
  default     = false
}

variable "git_branch" {
  type    = string
  default = "main"
}

variable "kustomize_overlay" {
  type    = string
  default = "prod"
}

variable "image_ref" {
  type    = string
  default = ""
}

variable "enable_ec2_k3s" {
  type    = bool
  default = true
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

variable "alarm_email" {
  type    = string
  default = ""
}

variable "github_token" {
  type      = string
  default   = ""
  sensitive = true
}

# Prod uses more RAM (cert-manager + 2 replicas + runner). t3.medium is NOT Free Tier.
variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "spot_instance_types" {
  type    = list(string)
  default = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "runner_labels" {
  type    = string
  default = "self-hosted,linux,x64,k3s-deploy,k3s-prod"
}

# Prod enables Let's Encrypt by default.
variable "enable_letsencrypt" {
  type    = bool
  default = true
}

variable "letsencrypt_email" {
  type    = string
  default = ""
}

variable "ses_from_email" {
  type    = string
  default = ""
}

variable "enable_emails" {
  type    = bool
  default = true
}

# Prod: deletion_protection on RDS.
variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = false
}
