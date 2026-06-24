variable "name" {
  description = "Prefix for naming resources (sg, role, asg, etc)."
  type        = string
}

variable "vpc_id" {
  description = "VPC where the instance will be launched."
  type        = string
}

variable "subnet_id" {
  description = "Public subnet for the EC2 (single-AZ by design)."
  type        = string
}

variable "instance_type" {
  description = "Main instance type for the Launch Template."
  type        = string
  default     = "t3.medium"
}

variable "spot_instance_types" {
  description = "Instance types the ASG can launch as Spot."
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "t3.large"]
}

variable "on_demand_base_capacity" {
  description = "Number of on-demand instances before applying the %."
  type        = number
  default     = 0
}

variable "on_demand_percentage_above_base_capacity" {
  description = "% on-demand above the base. 100 = pure on-demand."
  type        = number
  default     = 0
}

# ─── GitHub identity ──────────────────────────────────────────────────────
variable "github_owner" {
  description = "Owner of the repo."
  type        = string
}

variable "github_repo" {
  description = "Name of the repo."
  type        = string
}

variable "git_branch" {
  description = "Branch that user-data clones and applies on first boot."
  type        = string
  default     = "develop"
}

variable "kustomize_overlay" {
  description = "Overlay that user-data applies (dev / prod)."
  type        = string
  default     = "dev"
}

variable "kustomize_overlay_path" {
  description = "Relative path to the overlay within the repo."
  type        = string
  default     = "infra/k8s/overlays"
}

variable "github_token" {
  description = "Fine-grained PAT (Administration: read+write) used only at boot to register the self-hosted runner. Empty = skip runner."
  type        = string
  default     = ""
  sensitive   = true
}

variable "runner_version" {
  description = "Version of the actions runner."
  type        = string
  default     = "2.319.1"
}

variable "runner_labels" {
  description = "Runner labels (includes one unique per env: k3s-dev / k3s-prod)."
  type        = string
  default     = "self-hosted,linux,x64,k3s-deploy"
}

# ─── App ──────────────────────────────────────────────────────────────────
variable "image_ref" {
  description = "Full ECR URI (with tag) of the Next.js image to deploy initially."
  type        = string
}

variable "app_namespace" {
  description = "Kubernetes namespace where the app lives."
  type        = string
}

variable "aws_region" {
  description = "AWS region (injected into user-data for CW Agent and ECR)."
  type        = string
}

variable "public_host" {
  description = "Public FQDN. Empty = derive nip.io from the EIP."
  type        = string
  default     = ""
}

variable "public_host_prefix" {
  description = "Prefix for the nip.io hostname. E.g.: appointment-scheduling-dev"
  type        = string
  default     = "appointment-scheduling"
}

# ─── App ENV injected into Secret/ConfigMap ───────────────────────────────
variable "database_url_ssm_parameter" {
  description = "Path in SSM (SecureString) where DATABASE_URL lives — user-data reads it and writes it to the K8s Secret."
  type        = string
}

variable "nextauth_secret_ssm_parameter" {
  description = "Path in SSM (SecureString) where NEXTAUTH_SECRET lives. Created by the environment and injected into the K8s Secret."
  type        = string
}

variable "s3_bucket_name" {
  description = "Name of the assets bucket — written to ConfigMap as AWS_S3_BUCKET."
  type        = string
}

variable "ses_from_email" {
  description = "Verified sender email in SES. Written to ConfigMap as SES_FROM_EMAIL."
  type        = string
  default     = ""
}

variable "enable_emails" {
  description = "ENABLE_EMAILS for the app (false in dev without SES configured)."
  type        = bool
  default     = false
}

# ─── Extra permissions ───────────────────────────────────────────────────
variable "extra_managed_policy_arns" {
  description = "Additional ARNs to attach to the instance profile (e.g.: policy from s3-assets module, and SES policy)."
  type        = list(string)
  default     = []
}

# ─── Observabilidad ───────────────────────────────────────────────────────
variable "cloudwatch_agent_config" {
  description = "Install CloudWatch Agent (memory/disk metrics + user-data logs)."
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
  description = "ACME contact email (expiration notifications)."
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
