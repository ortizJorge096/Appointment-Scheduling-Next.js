variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix applied to most resources. dev = appointment-scheduling-dev."
  type        = string
  default     = "appointment-scheduling-dev"
}

variable "github_owner" {
  description = "Owner of the repo."
  type        = string
}

variable "github_repo" {
  description = "Repo (e.g.: Appointment-Scheduling-Next.js)."
  type        = string
}

variable "allowed_branches" {
  description = "Branches authorized via OIDC."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "allowed_environments" {
  description = "Authorized GitHub Environments."
  type        = list(string)
  default     = ["dev", "production"]
}

variable "create_oidc_provider" {
  description = "Create the OIDC provider in IAM. If it already exists in the account, set it to false."
  type        = bool
  default     = true
}

variable "git_branch" {
  description = "Branch that user-data clones during initialization."
  type        = string
  default     = "develop"
}

variable "kustomize_overlay" {
  description = "K8s overlay to apply."
  type        = string
  default     = "dev"
}

variable "image_ref" {
  description = "Initial image (empty = <ecr>:latest)."
  type        = string
  default     = ""
}

variable "enable_ec2_k3s" {
  description = "Create EC2 + k3s (true) or only VPC/ECR/OIDC/S3/RDS."
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Create monitoring (CloudWatch alarms + SNS)."
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email for alarms. Empty = no subscription."
  type        = string
  default     = ""
}

variable "github_token" {
  description = "PAT to register self-hosted runner. Empty = no runner."
  type        = string
  default     = ""
  sensitive   = true
}

variable "instance_type" {
  description = "EC2 instance type. t3.medium is NOT Free Tier — chosen for performance (k3s + 2 Next.js replicas + runner)."
  type        = string
  default     = "t3.medium"
}

variable "spot_instance_types" {
  description = "Types for Spot pool. Diversifying reduces probability of capacity shortage."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "runner_labels" {
  description = "Labels for the self-hosted runner."
  type        = string
  default     = "self-hosted,linux,x64,k3s-deploy,k3s-dev"
}

variable "enable_letsencrypt" {
  description = "Install cert-manager + Let's Encrypt. In dev defaults to false (saves RAM)."
  type        = bool
  default     = false
}

variable "letsencrypt_email" {
  description = "ACME email. Default: alarm_email."
  type        = string
  default     = ""
}

variable "ses_from_email" {
  description = "Verified sender in SES."
  type        = string
  default     = ""
}

variable "app_host" {
  description = "Public hostname for this environment (A record → Elastic IP). Single source of truth: feeds the module's resolved host (outputs + first-boot user-data) and the SSM param the CI reads for the ingress host, NEXTAUTH_URL and NEXT_PUBLIC_APP_URL. Empty = falls back to <name_prefix>.<ip>.nip.io."
  type        = string
  default     = ""
}

variable "enable_emails" {
  description = "ENABLE_EMAILS for the app."
  type        = bool
  default     = false
}

variable "ec2_ami" {
  description = "Fixed AMI ID for the launch template. Empty = uses the latest AL2023."
  type        = string
  default     = ""
}

variable "enable_rds_scheduler" {
  description = "Automatically shut down/start RDS during business hours. Recommended in dev to save costs."
  type        = bool
  default     = false
}

# Horario del scheduler, pasado al módulo (cron + timezone). Default de dev:
# apaga cada hora y NO enciende solo (lo arrancas a mano cuando lo necesitas).
variable "rds_stop_schedule" {
  type    = string
  default = "cron(0 * * * ? *)"
}

variable "rds_start_schedule" {
  type    = string
  default = ""   # "" = sin encendido automático (manual)
}

variable "rds_schedule_timezone" {
  type    = string
  default = "UTC"
}
variable "region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix applied to most resources. dev = appointment-scheduling-dev."
  type        = string
  default     = "appointment-scheduling-dev"
}

variable "github_owner" {
  description = "Owner of the repo."
  type        = string
}

variable "github_repo" {
  description = "Repo (e.g.: Appointment-Scheduling-Next.js)."
  type        = string
}

variable "allowed_branches" {
  description = "Branches authorized via OIDC."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "allowed_environments" {
  description = "Authorized GitHub Environments."
  type        = list(string)
  default     = ["dev", "production"]
}

variable "create_oidc_provider" {
  description = "Create the OIDC provider in IAM. If it already exists in the account, set it to false."
  type        = bool
  default     = true
}

variable "git_branch" {
  description = "Branch that user-data clones during initialization."
  type        = string
  default     = "develop"
}

variable "kustomize_overlay" {
  description = "K8s overlay to apply."
  type        = string
  default     = "dev"
}

variable "image_ref" {
  description = "Initial image (empty = <ecr>:latest)."
  type        = string
  default     = ""
}

variable "enable_ec2_k3s" {
  description = "Create EC2 + k3s (true) or only VPC/ECR/OIDC/S3/RDS."
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Create monitoring (CloudWatch alarms + SNS)."
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email for alarms. Empty = no subscription."
  type        = string
  default     = ""
}

variable "github_token" {
  description = "PAT to register self-hosted runner. Empty = no runner."
  type        = string
  default     = ""
  sensitive   = true
}

variable "instance_type" {
  description = "EC2 instance type. t3.medium is NOT Free Tier — chosen for performance (k3s + 2 Next.js replicas + runner)."
  type        = string
  default     = "t3.medium"
}

variable "spot_instance_types" {
  description = "Types for Spot pool. Diversifying reduces probability of capacity shortage."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "runner_labels" {
  description = "Labels for the self-hosted runner."
  type        = string
  default     = "self-hosted,linux,x64,k3s-deploy,k3s-dev"
}

variable "enable_letsencrypt" {
  description = "Install cert-manager + Let's Encrypt. In dev defaults to false (saves RAM)."
  type        = bool
  default     = false
}

variable "letsencrypt_email" {
  description = "ACME email. Default: alarm_email."
  type        = string
  default     = ""
}

variable "ses_from_email" {
  description = "Verified sender in SES."
  type        = string
  default     = ""
}

variable "google_private_key" {
  description = "Google Calendar service-account private key (the private_key field of the JSON). Provide via TF_VAR_google_private_key or a gitignored tfvars — NEVER commit it. Empty keeps whatever value is already in SSM (ignore_changes)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "app_host" {
  description = "Public hostname for this environment (A record → Elastic IP). Single source of truth: feeds the module's resolved host (outputs + first-boot user-data) and the SSM param the CI reads for the ingress host, NEXTAUTH_URL and NEXT_PUBLIC_APP_URL. Empty = falls back to <name_prefix>.<ip>.nip.io."
  type        = string
  default     = ""
}

variable "enable_emails" {
  description = "ENABLE_EMAILS for the app."
  type        = bool
  default     = false
}

variable "ec2_ami" {
  description = "Fixed AMI ID for the launch template. Empty = uses the latest AL2023."
  type        = string
  default     = ""
}

variable "enable_rds_scheduler" {
  description = "Automatically shut down/start RDS during business hours. Recommended in dev to save costs."
  type        = bool
  default     = false
}

# Horario del scheduler, pasado al módulo (cron + timezone). Default de dev:
# apaga cada hora y NO enciende solo (lo arrancas a mano cuando lo necesitas).
variable "rds_stop_schedule" {
  type    = string
  default = "cron(0 * * * ? *)"
}

variable "rds_start_schedule" {
  type    = string
  default = "" # "" = sin encendido automático (manual)
}

variable "rds_schedule_timezone" {
  type    = string
  default = "UTC"
}
