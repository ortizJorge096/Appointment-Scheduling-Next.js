variable "region" {
  description = "AWS region for the free-tier account's prod DB."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Named AWS CLI profile for the SEPARATE free-tier account (its own credentials)."
  type        = string
}

variable "name" {
  description = "Resource name + SSM path prefix inside the free-tier account."
  type        = string
  default     = "appointment-scheduling"
}

variable "operator_ip_cidr" {
  description = "Your workstation's public IP as a /32, to run the restore/verify. Get it with: curl -s https://checkip.amazonaws.com"
  type        = string

  validation {
    condition     = endswith(var.operator_ip_cidr, "/32")
    error_message = "Must be a single-host /32 (e.g. 203.0.113.10/32)."
  }
}

variable "cluster_eip_cidr" {
  description = "The k3s cluster's Elastic IP as a /32 (main account: terraform output, the ec2-k3s public_ip). Lets the app reach this DB over the internet."
  type        = string

  validation {
    condition     = endswith(var.cluster_eip_cidr, "/32")
    error_message = "Must be a single-host /32 (e.g. 198.51.100.20/32)."
  }
}

variable "engine_version" {
  description = "Must match or exceed the source DB major so pg_restore is clean. Source is 16.4."
  type        = string
  default     = "16.4"
}
