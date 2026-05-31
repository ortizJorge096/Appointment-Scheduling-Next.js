variable "region" {
  description = "Región AWS."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefijo aplicado a la mayoría de recursos. dev = appointment-scheduling-dev."
  type        = string
  default     = "appointment-scheduling-dev"
}

variable "github_owner" {
  description = "Owner del repo."
  type        = string
}

variable "github_repo" {
  description = "Repo (ej: Appointment-Scheduling-Next.js)."
  type        = string
}

variable "allowed_branches" {
  description = "Branches autorizadas vía OIDC."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "allowed_environments" {
  description = "GitHub Environments autorizados."
  type        = list(string)
  default     = ["dev", "production"]
}

variable "create_oidc_provider" {
  description = "Crear el OIDC provider en IAM. Si ya existe en la cuenta, ponlo en false."
  type        = bool
  default     = true
}

variable "git_branch" {
  description = "Branch que el user-data clona al inicializar."
  type        = string
  default     = "develop"
}

variable "kustomize_overlay" {
  description = "Overlay K8s a aplicar."
  type        = string
  default     = "dev"
}

variable "image_ref" {
  description = "Imagen inicial (vacío = <ecr>:latest)."
  type        = string
  default     = ""
}

variable "enable_ec2_k3s" {
  description = "Crear EC2 + k3s (true) o solo VPC/ECR/OIDC/S3/RDS."
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Crear monitoring (CloudWatch alarms + SNS)."
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email para alarmas. Vacío = sin suscripción."
  type        = string
  default     = ""
}

variable "github_token" {
  description = "PAT para registrar self-hosted runner. Vacío = no runner."
  type        = string
  default     = ""
  sensitive   = true
}

variable "instance_type" {
  description = "EC2 instance type. t3.medium NO es Free Tier — elegido por performance (k3s + 2 réplicas Next.js + runner)."
  type        = string
  default     = "t3.medium"
}

variable "spot_instance_types" {
  description = "Tipos para Spot pool. Diversificar reduce probabilidad de capacity shortage."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "runner_labels" {
  description = "Labels del self-hosted runner."
  type        = string
  default     = "self-hosted,linux,x64,k3s-deploy,k3s-dev"
}

variable "enable_letsencrypt" {
  description = "Instalar cert-manager + Let's Encrypt. En dev por defecto false (ahorra RAM)."
  type        = bool
  default     = false
}

variable "letsencrypt_email" {
  description = "Email ACME. Default: alarm_email."
  type        = string
  default     = ""
}

variable "ses_from_email" {
  description = "Remitente verificado en SES."
  type        = string
  default     = ""
}

variable "enable_emails" {
  description = "ENABLE_EMAILS para la app."
  type        = bool
  default     = false
}
