variable "bucket_name" {
  description = "Globally unique bucket name (e.g.: appointment-scheduling-assets-<env>)."
  type        = string
}

variable "public_prefixes" {
  description = "Bucket prefixes with public read access via bucket policy."
  type        = list(string)
  default     = ["gallery/"]
}

variable "allowed_origins" {
  description = "Origins allowed by CORS (admin uploads directly from the browser)."
  type        = list(string)
}

variable "enable_versioning" {
  description = "Versioning on the bucket."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags."
  type        = map(string)
  default     = {}
}
