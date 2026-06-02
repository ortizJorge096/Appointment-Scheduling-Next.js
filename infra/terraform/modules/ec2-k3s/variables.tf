variable "name" {
  description = "Prefijo para nombrar recursos (sg, role, asg, etc)."
  type        = string
}

variable "vpc_id" {
  description = "VPC donde lanzar la instancia."
  type        = string
}

variable "subnet_id" {
  description = "Subnet pública para la EC2 (single-AZ por diseño)."
  type        = string
}

variable "instance_type" {
  description = "Tipo principal para la Launch Template."
  type        = string
  default     = "t3.medium"
}

variable "spot_instance_types" {
  description = "Tipos que la ASG puede lanzar como Spot."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "on_demand_base_capacity" {
  description = "Cantidad de instancias on-demand antes de aplicar el %."
  type        = number
  default     = 0
}

variable "on_demand_percentage_above_base_capacity" {
  description = "% on-demand sobre el base. 100 = pure on-demand."
  type        = number
  default     = 0
}

# ─── GitHub identity ──────────────────────────────────────────────────────
variable "github_owner" {
  description = "Owner del repo."
  type        = string
}

variable "github_repo" {
  description = "Nombre del repo."
  type        = string
}

variable "git_branch" {
  description = "Branch que el user-data clona y aplica en el primer boot."
  type        = string
  default     = "develop"
}

variable "kustomize_overlay" {
  description = "Overlay que el user-data aplica (dev / prod)."
  type        = string
  default     = "dev"
}

variable "kustomize_overlay_path" {
  description = "Path relativo al overlay dentro del repo."
  type        = string
  default     = "infra/k8s/overlays"
}

variable "github_token" {
  description = "Fine-grained PAT (Administration: read+write) usado solo en boot para registrar el self-hosted runner. Vacío = saltar runner."
  type        = string
  default     = ""
  sensitive   = true
}

variable "runner_version" {
  description = "Versión del actions runner."
  type        = string
  default     = "2.319.1"
}

variable "runner_labels" {
  description = "Labels del runner (incluye uno único por env: k3s-dev / k3s-prod)."
  type        = string
  default     = "self-hosted,linux,x64,k3s-deploy"
}

# ─── App ──────────────────────────────────────────────────────────────────
variable "image_ref" {
  description = "URI ECR completa (con tag) de la imagen Next.js a desplegar inicialmente."
  type        = string
}

variable "app_namespace" {
  description = "Namespace de Kubernetes donde vive la app."
  type        = string
}

variable "aws_region" {
  description = "Región AWS (se inyecta en user-data para el CW Agent y ECR)."
  type        = string
}

variable "public_host" {
  description = "FQDN público. Vacío = derivar nip.io desde el EIP."
  type        = string
  default     = ""
}

variable "public_host_prefix" {
  description = "Prefijo del hostname nip.io. Ej: appointment-scheduling-dev"
  type        = string
  default     = "appointment-scheduling"
}

# ─── App ENV inyectado al Secret/ConfigMap ────────────────────────────────
variable "database_url_ssm_parameter" {
  description = "Path en SSM (SecureString) donde vive la DATABASE_URL — la lee user-data y la escribe al Secret de K8s."
  type        = string
}

variable "nextauth_secret_ssm_parameter" {
  description = "Path en SSM (SecureString) donde vive NEXTAUTH_SECRET. Lo crea el environment y se inyecta al Secret de K8s."
  type        = string
}

variable "s3_bucket_name" {
  description = "Nombre del bucket de assets — se escribe en el ConfigMap como AWS_S3_BUCKET."
  type        = string
}

variable "ses_from_email" {
  description = "Email remitente verificado en SES. Se escribe en el ConfigMap como SES_FROM_EMAIL."
  type        = string
  default     = ""
}

variable "enable_emails" {
  description = "ENABLE_EMAILS para la app (false en dev sin SES configurado)."
  type        = bool
  default     = false
}

# ─── Permisos extra ──────────────────────────────────────────────────────
variable "extra_managed_policy_arns" {
  description = "ARNs adicionales a adjuntar al instance profile (ej: la policy del módulo s3-assets, y la de SES)."
  type        = list(string)
  default     = []
}

# ─── Observabilidad ───────────────────────────────────────────────────────
variable "cloudwatch_agent_config" {
  description = "Instalar CloudWatch Agent (memory/disk metrics + logs de user-data)."
  type        = bool
  default     = true
}

# ─── TLS ──────────────────────────────────────────────────────────────────
variable "enable_letsencrypt" {
  description = "Instalar cert-manager + ClusterIssuers."
  type        = bool
  default     = false
}

variable "letsencrypt_email" {
  description = "Email de contacto ACME (notificaciones de expiración)."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}

variable "ami_id" {
  description = "AMI ID to use. If empty, the latest Amazon Linux 2023 AMI is used."
  type        = string
  default     = ""
}
